/**
 * SeatService for EventSphere.
 * Manages real-time seat states, Redis distributed locking (TTL 10m),
 * atomic state transitions, and WebSocket broadcasts.
 */

const { seatRepository, eventRepository } = require('../repositories');
const { acquireSeatLock, releaseSeatLock, getSeatLockStatus } = require('../config/redis');
const { broadcastSeatLock, broadcastSeatUnlock } = require('../socket');
const { SeatUnavailableError, NotFoundError } = require('../errors');
const logger = require('../config/logger');

class SeatService {
  /**
   * Retrieves all seats for an event, merging MongoDB records with live Redis lock states.
   * @param {string} eventId
   * @param {string|null} currentUserId
   */
  async getEventSeats(eventId, currentUserId = null) {
    const seats = await seatRepository.findByEventId(eventId);

    // Merge in-flight Redis lock TTLs
    const enhancedSeats = await Promise.all(
      seats.map(async (seat) => {
        const plain = seat.toObject();

        if (plain.status === 'BOOKED') {
          return { ...plain, isLocked: false, isBooked: true };
        }

        const lock = await getSeatLockStatus(eventId, seat._id.toString());
        if (lock.locked) {
          return {
            ...plain,
            status: 'LOCKED',
            isLocked: true,
            isLockedByMe: Boolean(currentUserId && lock.userId === currentUserId.toString()),
            lockTtlSeconds: lock.ttl,
          };
        }

        return {
          ...plain,
          status: 'AVAILABLE',
          isLocked: false,
          isLockedByMe: false,
          lockTtlSeconds: 0,
        };
      })
    );

    return enhancedSeats;
  }

  /**
   * Acquire a 10-minute temporary distributed lock on a seat.
   * @param {string} eventId
   * @param {string} seatId
   * @param {string} userId
   */
  async lockSeat(eventId, seatId, userId) {
    // 1. Verify seat existence
    const seat = await seatRepository.findById(seatId);
    if (!seat || seat.eventId.toString() !== eventId.toString()) {
      throw new NotFoundError('Seat does not exist for this event.');
    }

    // 2. Check permanent database state
    if (seat.status === 'BOOKED') {
      throw new SeatUnavailableError('Seat is already booked.');
    }

    // 3. Acquire atomic Redis distributed lock (TTL 600s = 10 minutes)
    const acquired = await acquireSeatLock(eventId, seatId, userId.toString(), 600);
    if (!acquired) {
      // Check if current user already holds the lock
      const status = await getSeatLockStatus(eventId, seatId);
      if (status.locked && status.userId === userId.toString()) {
        return {
          success: true,
          seatId,
          status: 'LOCKED',
          isLockedByMe: true,
          remainingSeconds: status.ttl,
        };
      }
      throw new SeatUnavailableError('Seat is currently held by another user.');
    }

    const expiresAt = new Date(Date.now() + 600 * 1000);

    // 4. Update MongoDB optimistic lock record
    await seatRepository.updateById(seatId, {
      status: 'LOCKED',
      lockedBy: userId,
      lockExpiresAt: expiresAt,
    });

    // 5. Broadcast real-time lock to all users in event room
    broadcastSeatLock(eventId, seatId, userId.toString(), expiresAt);

    logger.info('Seat locked successfully', { eventId, seatId, userId });

    return {
      success: true,
      seatId,
      status: 'LOCKED',
      isLockedByMe: true,
      remainingSeconds: 600,
      lockExpiresAt: expiresAt,
    };
  }

  /**
   * Release a temporary distributed seat lock.
   * @param {string} eventId
   * @param {string} seatId
   * @param {string} userId
   * @param {boolean} force - Force release by admin/organizer
   */
  async unlockSeat(eventId, seatId, userId, force = false) {
    const seat = await seatRepository.findById(seatId);
    if (!seat || seat.eventId.toString() !== eventId.toString()) {
      throw new NotFoundError('Seat not found.');
    }

    if (seat.status === 'BOOKED') {
      throw new SeatUnavailableError('Cannot unlock a confirmed booked seat.');
    }

    // Release Redis lock
    await releaseSeatLock(eventId, seatId, userId.toString(), force);

    // Update MongoDB
    await seatRepository.updateById(seatId, {
      status: 'AVAILABLE',
      lockedBy: null,
      lockExpiresAt: null,
    });

    // Broadcast unlock to all event participants
    broadcastSeatUnlock(eventId, seatId);

    logger.info('Seat unlocked', { eventId, seatId, userId });

    return {
      success: true,
      seatId,
      status: 'AVAILABLE',
    };
  }
}

module.exports = new SeatService();

/**
 * BookingService for EventSphere.
 * Manages booking reservations, lifecycle state transitions (RESERVED, CONFIRMED, CANCELLED, EXPIRED),
 * and financial calculation.
 */

const { bookingRepository, eventRepository, seatRepository, paymentRepository } = require('../repositories');
const { getSeatLockStatus, acquireSeatLock, releaseSeatLock } = require('../config/redis');
const domainEventEmitter = require('../events/eventEmitter');
const DOMAIN_EVENTS = require('../events/domainEvents');
const { NotFoundError, SeatUnavailableError, ConflictError, ForbiddenError, ValidationError } = require('../errors');
const logger = require('../config/logger');

class BookingService {
  /**
   * Create a temporary reservation intent holding locked seats for 10 minutes.
   * @param {string} userId
   * @param {object} payload - { eventId, seatIds, idempotencyKey }
   */
  async createBookingIntent(userId, { eventId, seatIds, idempotencyKey }) {
    if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
      throw new ValidationError('At least one seat must be selected.');
    }

    if (seatIds.length > 10) {
      throw new ValidationError('Maximum 10 seats allowed per transaction.');
    }

    // 1. Verify event validity
    const event = await eventRepository.findById(eventId);
    if (!event || event.status !== 'PUBLISHED') {
      throw new NotFoundError('Event not found or not open for bookings.');
    }

    // 2. Fetch and validate all seats
    const seats = await seatRepository.findSeatsByIds(seatIds, eventId);
    if (seats.length !== seatIds.length) {
      throw new NotFoundError('One or more selected seats do not exist for this event.');
    }

    // 3. Verify that all seats are available and locked by this user
    for (const seat of seats) {
      if (seat.status === 'BOOKED') {
        throw new SeatUnavailableError(`Seat ${seat.row}${seat.seatNumber} is already booked.`);
      }

      const lock = await getSeatLockStatus(eventId, seat._id.toString());
      if (!lock.locked) {
        // Automatically acquire lock on behalf of user if not yet locked
        const acquired = await acquireSeatLock(eventId, seat._id.toString(), userId.toString(), 600);
        if (!acquired) {
          throw new SeatUnavailableError(`Seat ${seat.row}${seat.seatNumber} could not be reserved.`);
        }
      } else if (lock.userId !== userId.toString()) {
        throw new SeatUnavailableError(`Seat ${seat.row}${seat.seatNumber} is held by another user.`);
      }
    }

    // 4. Compute pricing
    const totalAmount = seats.reduce((sum, s) => sum + s.price, 0);
    const discountAmount = 0; // Configurable for promo codes
    const finalAmount = totalAmount - discountAmount;

    // 5. Generate unique booking reference number
    const bookingNumber = `ES-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const reservationExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // 6. Persist RESERVED booking
    const booking = await bookingRepository.create({
      bookingNumber,
      user: userId,
      event: eventId,
      seats: seatIds,
      totalAmount,
      discountAmount,
      finalAmount,
      status: 'RESERVED',
      reservationExpiresAt,
      idempotencyKey,
    });

    logger.info('Booking intent created', {
      bookingNumber,
      userId,
      eventId,
      seatCount: seatIds.length,
      finalAmount,
    });

    domainEventEmitter.emit(DOMAIN_EVENTS.BOOKING_CREATED, { booking, event, seats });

    return {
      booking: {
        id: booking._id,
        bookingNumber: booking.bookingNumber,
        status: booking.status,
        seats,
        totalAmount,
        discountAmount,
        finalAmount,
        reservationExpiresAt,
        timeRemainingSeconds: 600,
      },
    };
  }

  /**
   * Get paginated bookings for a user.
   */
  async getUserBookings(userId, options) {
    return bookingRepository.findByUser(userId, options);
  }

  /**
   * Get detailed booking by ID.
   */
  async getBookingDetails(bookingId, userId, userRole) {
    const booking = await bookingRepository.findByIdDetailed(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found.');
    }

    if (userRole !== 'ADMIN' && booking.user._id.toString() !== userId.toString()) {
      throw new ForbiddenError('You are not authorized to view this booking.');
    }

    const payment = await paymentRepository.findByBookingId(bookingId);

    return {
      booking,
      payment,
    };
  }

  /**
   * Cancel a booking and release reserved seats.
   */
  async cancelBooking(bookingId, userId, userRole, reason) {
    const booking = await bookingRepository.findByIdDetailed(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found.');
    }

    if (userRole !== 'ADMIN' && booking.user._id.toString() !== userId.toString()) {
      throw new ForbiddenError('Not authorized to cancel this booking.');
    }

    if (['CANCELLED', 'EXPIRED'].includes(booking.status)) {
      throw new ConflictError(`Booking is already ${booking.status.toLowerCase()}.`);
    }

    // Release Redis distributed locks
    for (const seat of booking.seats) {
      await releaseSeatLock(booking.event._id.toString(), seat._id.toString(), userId, true);
    }

    // Update Seat documents to AVAILABLE
    await seatRepository.markSeatsAvailable(booking.seats.map(s => s._id));

    // Restore event inventory if it was confirmed
    if (booking.status === 'CONFIRMED') {
      await eventRepository.incrementAvailableSeats(booking.event._id, booking.seats.length);
    }

    // Update booking status
    const updated = await bookingRepository.updateById(bookingId, {
      status: 'CANCELLED',
      cancellationReason: reason || 'Cancelled by user',
      cancelledAt: new Date(),
    });

    domainEventEmitter.emit(DOMAIN_EVENTS.BOOKING_CANCELLED, {
      booking: updated,
      event: booking.event,
      user: booking.user,
    });

    logger.info('Booking cancelled', { bookingId, bookingNumber: booking.bookingNumber });

    return updated;
  }
}

module.exports = new BookingService();

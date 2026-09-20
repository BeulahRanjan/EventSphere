/**
 * SeatRepository for seat layout, availability, and state queries.
 */

const BaseRepository = require('./BaseRepository');
const { Seat } = require('../models');

class SeatRepository extends BaseRepository {
  constructor() {
    super(Seat);
  }

  async findByEventId(eventId) {
    return this.model.find({ eventId }).sort({ section: 1, row: 1, seatNumber: 1 });
  }

  async findSeatsByIds(seatIds, eventId = null) {
    const filter = { _id: { $in: seatIds } };
    if (eventId) {
      filter.eventId = eventId;
    }
    return this.model.find(filter);
  }

  async markSeatsLocked(seatIds, userId, expiresAt) {
    return this.model.updateMany(
      { _id: { $in: seatIds }, status: 'AVAILABLE' },
      {
        $set: {
          status: 'LOCKED',
          lockedBy: userId,
          lockExpiresAt: expiresAt,
        },
      }
    );
  }

  async markSeatsAvailable(seatIds) {
    return this.model.updateMany(
      { _id: { $in: seatIds } },
      {
        $set: {
          status: 'AVAILABLE',
          lockedBy: null,
          lockExpiresAt: null,
        },
      }
    );
  }

  async markSeatsBooked(seatIds, session = null) {
    const options = session ? { session } : {};
    return this.model.updateMany(
      { _id: { $in: seatIds } },
      {
        $set: {
          status: 'BOOKED',
          lockedBy: null,
          lockExpiresAt: null,
        },
      },
      options
    );
  }

  async releaseExpiredLocks() {
    const now = new Date();
    return this.model.updateMany(
      { status: 'LOCKED', lockExpiresAt: { $lte: now } },
      {
        $set: {
          status: 'AVAILABLE',
          lockedBy: null,
          lockExpiresAt: null,
        },
      }
    );
  }
}

module.exports = new SeatRepository();

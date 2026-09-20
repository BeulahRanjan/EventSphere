/**
 * BookingRepository for booking state transitions and user history.
 */

const BaseRepository = require('./BaseRepository');
const { Booking } = require('../models');

class BookingRepository extends BaseRepository {
  constructor() {
    super(Booking);
  }

  async findByBookingNumber(bookingNumber) {
    return this.model.findOne({ bookingNumber })
      .populate('user', 'name email phone')
      .populate({
        path: 'event',
        populate: [{ path: 'venue' }, { path: 'category' }],
      })
      .populate('seats');
  }

  async findByIdDetailed(id) {
    return this.model.findById(id)
      .populate('user', 'name email phone')
      .populate({
        path: 'event',
        populate: [{ path: 'venue' }, { path: 'category' }],
      })
      .populate('seats');
  }

  async findByUser(userId, { page = 1, limit = 10 }) {
    return this.paginate(
      { user: userId },
      {
        page,
        limit,
        sort: { createdAt: -1 },
        populate: [
          {
            path: 'event',
            select: 'title bannerUrl startDate endDate venue',
            populate: { path: 'venue', select: 'name city address' },
          },
          { path: 'seats', select: 'section row seatNumber tier price' },
        ],
      }
    );
  }

  async findExpiredReservations() {
    const now = new Date();
    return this.model.find({
      status: 'RESERVED',
      reservationExpiresAt: { $lte: now },
    });
  }

  async updateStatus(bookingId, status, session = null) {
    const options = session ? { session, new: true } : { new: true };
    return this.model.findByIdAndUpdate(bookingId, { status }, options);
  }
}

module.exports = new BookingRepository();

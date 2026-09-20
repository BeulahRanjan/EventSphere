/**
 * TicketRepository for QR verification and ticket state persistence.
 */

const BaseRepository = require('./BaseRepository');
const { Ticket } = require('../models');

class TicketRepository extends BaseRepository {
  constructor() {
    super(Ticket);
  }

  async findByVerificationToken(verificationToken) {
    return this.model.findOne({ verificationToken })
      .populate('user', 'name email phone')
      .populate({
        path: 'event',
        populate: [{ path: 'venue' }, { path: 'organizer', select: 'name email' }],
      })
      .populate('seat')
      .populate('booking', 'bookingNumber status');
  }

  async findByTicketNumber(ticketNumber) {
    return this.model.findOne({ ticketNumber })
      .populate('user', 'name email')
      .populate('event')
      .populate('seat');
  }

  async findByBooking(bookingId) {
    return this.model.find({ booking: bookingId })
      .populate('event', 'title startDate endDate venue')
      .populate('seat');
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
            populate: { path: 'venue', select: 'name city address' },
          },
          { path: 'seat' },
          { path: 'booking', select: 'bookingNumber status' },
        ],
      }
    );
  }

  async markUsed(ticketId) {
    return this.model.findByIdAndUpdate(
      ticketId,
      {
        status: 'USED',
        usedAt: new Date(),
      },
      { new: true }
    );
  }
}

module.exports = new TicketRepository();

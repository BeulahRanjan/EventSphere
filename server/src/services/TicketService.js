/**
 * TicketService for EventSphere.
 * Manages ticket access, QR code display, and cryptographic ticket verification at venues.
 */

const { ticketRepository } = require('../repositories');
const { NotFoundError, ConflictError, ForbiddenError } = require('../errors');
const logger = require('../config/logger');

class TicketService {
  /**
   * Get single ticket details.
   * @param {string} ticketId
   * @param {string} userId
   * @param {string} userRole
   */
  async getTicketDetails(ticketId, userId, userRole) {
    const ticket = await ticketRepository.findById(ticketId, null, {
      populate: [
        { path: 'event', populate: { path: 'venue' } },
        { path: 'seat' },
        { path: 'user', select: 'name email phone' },
        { path: 'booking', select: 'bookingNumber status finalAmount' },
      ],
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found.');
    }

    if (userRole !== 'ADMIN' && ticket.user._id.toString() !== userId.toString()) {
      throw new ForbiddenError('You are not authorized to view this ticket.');
    }

    return ticket;
  }

  /**
   * Get all tickets belonging to a user.
   */
  async getUserTickets(userId, options) {
    return ticketRepository.findByUser(userId, options);
  }

  /**
   * Verify and scan an attendee's QR ticket token at the venue entrance.
   * Verifies authenticity, booking state, event state, and prevents duplicate entry.
   * @param {string} verificationToken
   */
  async verifyTicket(verificationToken) {
    logger.info('Verifying ticket token', { tokenPrefix: verificationToken.substring(0, 10) });

    const ticket = await ticketRepository.findByVerificationToken(verificationToken);
    if (!ticket) {
      throw new NotFoundError('Invalid verification token. Ticket not found.');
    }

    // 1. Prevent duplicate usage
    if (ticket.status === 'USED' || ticket.usedAt) {
      throw new ConflictError(
        `Ticket already used on ${new Date(ticket.usedAt).toLocaleString()}. Duplicate entry denied.`
      );
    }

    // 2. Verify ticket state
    if (ticket.status === 'CANCELLED') {
      throw new ConflictError('This ticket has been cancelled and is invalid for entry.');
    }

    // 3. Verify booking confirmation
    if (ticket.booking && ticket.booking.status !== 'CONFIRMED') {
      throw new ConflictError(`Associated booking is ${ticket.booking.status}. Entry denied.`);
    }

    // 4. Verify event state
    if (ticket.event && ticket.event.status === 'CANCELLED') {
      throw new ConflictError('The event has been cancelled.');
    }

    // Mark ticket as USED
    const updatedTicket = await ticketRepository.markUsed(ticket._id);

    logger.info('Ticket scanned and verified successfully', {
      ticketNumber: ticket.ticketNumber,
      attendee: ticket.user.name,
      seat: `${ticket.seat.row}${ticket.seat.seatNumber}`,
    });

    return {
      verified: true,
      scannedAt: updatedTicket.usedAt,
      ticket: {
        ticketNumber: ticket.ticketNumber,
        status: updatedTicket.status,
      },
      attendee: {
        name: ticket.user.name,
        email: ticket.user.email,
        phone: ticket.user.phone,
      },
      event: {
        id: ticket.event._id,
        title: ticket.event.title,
        startDate: ticket.event.startDate,
        venue: ticket.event.venue ? ticket.event.venue.name : 'Main Arena',
      },
      seat: {
        section: ticket.seat.section,
        row: ticket.seat.row,
        seatNumber: ticket.seat.seatNumber,
        tier: ticket.seat.tier,
      },
    };
  }
}

module.exports = new TicketService();

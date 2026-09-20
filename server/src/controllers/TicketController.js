/**
 * TicketController for EventSphere.
 * Manages ticket viewing and venue gate scanning validation.
 */

const { ticketService } = require('../services');
const { sendSuccess } = require('../utils/response');

class TicketController {
  async getTicket(req, res, next) {
    try {
      const ticket = await ticketService.getTicketDetails(req.params.id, req.user._id, req.user.role);
      return sendSuccess(res, 'Ticket retrieved', ticket);
    } catch (error) {
      next(error);
    }
  }

  async getUserTickets(req, res, next) {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '10', 10);
      const tickets = await ticketService.getUserTickets(req.user._id, { page, limit });
      return sendSuccess(res, 'User tickets retrieved', tickets);
    } catch (error) {
      next(error);
    }
  }

  async verifyTicket(req, res, next) {
    try {
      const token = req.body.token || req.params.token;
      const result = await ticketService.verifyTicket(token);
      return sendSuccess(res, 'Ticket verified. Access granted.', result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TicketController();

/**
 * SeatController for EventSphere.
 * Manages interactive seat maps, distributed locks, and release endpoints.
 */

const { seatService } = require('../services');
const { sendSuccess } = require('../utils/response');

class SeatController {
  async getSeats(req, res, next) {
    try {
      const { eventId } = req.params;
      const currentUserId = req.user ? req.user._id : null;
      const seats = await seatService.getEventSeats(eventId, currentUserId);
      return sendSuccess(res, 'Seats retrieved', seats);
    } catch (error) {
      next(error);
    }
  }

  async lockSeat(req, res, next) {
    try {
      const { eventId, seatId } = req.params;
      const result = await seatService.lockSeat(eventId, seatId, req.user._id);
      return sendSuccess(res, 'Seat locked temporarily', result);
    } catch (error) {
      next(error);
    }
  }

  async unlockSeat(req, res, next) {
    try {
      const { eventId, seatId } = req.params;
      const force = req.user.role === 'ADMIN' || req.user.role === 'EVENT_ORGANIZER';
      const result = await seatService.unlockSeat(eventId, seatId, req.user._id, force);
      return sendSuccess(res, 'Seat unlocked successfully', result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SeatController();

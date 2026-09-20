/**
 * BookingController for EventSphere.
 * Manages booking reservations, customer history, and cancellation endpoints.
 */

const { bookingService } = require('../services');
const { sendSuccess } = require('../utils/response');

class BookingController {
  async createIntent(req, res, next) {
    try {
      const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;
      const result = await bookingService.createBookingIntent(req.user._id, {
        ...req.body,
        idempotencyKey,
      });
      return sendSuccess(res, 'Booking reservation created. Complete payment within 10 minutes.', result, 201);
    } catch (error) {
      next(error);
    }
  }

  async getUserBookings(req, res, next) {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '10', 10);
      const bookings = await bookingService.getUserBookings(req.user._id, { page, limit });
      return sendSuccess(res, 'Bookings retrieved', bookings);
    } catch (error) {
      next(error);
    }
  }

  async getBookingDetails(req, res, next) {
    try {
      const result = await bookingService.getBookingDetails(req.params.id, req.user._id, req.user.role);
      return sendSuccess(res, 'Booking details retrieved', result);
    } catch (error) {
      next(error);
    }
  }

  async cancelBooking(req, res, next) {
    try {
      const { reason } = req.body;
      const booking = await bookingService.cancelBooking(req.params.id, req.user._id, req.user.role, reason);
      return sendSuccess(res, 'Booking cancelled successfully', booking);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new BookingController();

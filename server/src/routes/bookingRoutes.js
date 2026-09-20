/**
 * Booking Routes for EventSphere.
 */

const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/BookingController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { bookingLimiter } = require('../middleware/rateLimiter');
const idempotencyMiddleware = require('../middleware/idempotency');
const validate = require('../middleware/validatorHandler');
const { createBookingValidator, cancelBookingValidator } = require('../validators/bookingValidators');

// Create temporary reservation intent
router.post(
  '/',
  authMiddleware,
  bookingLimiter,
  idempotencyMiddleware(600),
  createBookingValidator,
  validate,
  bookingController.createIntent
);

// Get user bookings
router.get('/', authMiddleware, bookingController.getUserBookings);

// Get detailed booking
router.get('/:id', authMiddleware, bookingController.getBookingDetails);

// Cancel booking
router.post('/:id/cancel', authMiddleware, cancelBookingValidator, validate, bookingController.cancelBooking);

module.exports = router;

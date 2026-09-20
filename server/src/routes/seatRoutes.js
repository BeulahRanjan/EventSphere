/**
 * Seat Routes for EventSphere.
 */

const express = require('express');
const router = express.Router();
const seatController = require('../controllers/SeatController');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/authMiddleware');
const { bookingLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validatorHandler');
const { seatParamValidator } = require('../validators/seatValidators');

// Get seat map with current locks
router.get('/:eventId', optionalAuthMiddleware, seatController.getSeats);

// Acquire 10-minute temporary seat lock
router.post(
  '/:eventId/:seatId/lock',
  authMiddleware,
  bookingLimiter,
  seatParamValidator,
  validate,
  seatController.lockSeat
);

// Release seat lock
router.post(
  '/:eventId/:seatId/unlock',
  authMiddleware,
  seatParamValidator,
  validate,
  seatController.unlockSeat
);

module.exports = router;

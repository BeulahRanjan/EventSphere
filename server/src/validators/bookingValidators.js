/**
 * Booking input validation schemas using express-validator.
 */

const { body, param } = require('express-validator');

const createBookingValidator = [
  body('eventId')
    .isMongoId()
    .withMessage('Valid event ID is required.'),
  body('seatIds')
    .isArray({ min: 1, max: 10 })
    .withMessage('Between 1 and 10 seats must be selected.'),
  body('seatIds.*')
    .isMongoId()
    .withMessage('Each seat ID must be a valid Mongo ID.'),
];

const cancelBookingValidator = [
  param('id')
    .isMongoId()
    .withMessage('Valid booking ID is required.'),
  body('reason')
    .optional()
    .trim(),
];

module.exports = {
  createBookingValidator,
  cancelBookingValidator,
};

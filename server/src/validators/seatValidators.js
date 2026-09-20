/**
 * Seat and Ticket input validation schemas.
 */

const { param, body } = require('express-validator');

const seatParamValidator = [
  param('eventId').isMongoId().withMessage('Valid event ID required.'),
  param('seatId').isMongoId().withMessage('Valid seat ID required.'),
];

const verifyTicketValidator = [
  body('token').trim().notEmpty().withMessage('Verification token is required.'),
];

module.exports = {
  seatParamValidator,
  verifyTicketValidator,
};

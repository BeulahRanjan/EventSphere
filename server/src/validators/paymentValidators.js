/**
 * Payment input validation schemas using express-validator.
 */

const { body } = require('express-validator');

const createPaymentOrderValidator = [
  body('bookingId')
    .isMongoId()
    .withMessage('Valid booking ID is required.'),
  body('paymentMethod')
    .optional()
    .isIn(['UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'NET_BANKING', 'WALLET'])
    .withMessage('Invalid payment method selected.'),
];

const paymentWebhookValidator = [
  body('transactionId')
    .notEmpty()
    .withMessage('Transaction ID is required.'),
  body('status')
    .isIn(['SUCCESS', 'FAILED'])
    .withMessage('Payment status must be SUCCESS or FAILED.'),
];

module.exports = {
  createPaymentOrderValidator,
  paymentWebhookValidator,
};

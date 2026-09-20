/**
 * Payment Routes for EventSphere.
 */

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/PaymentController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { paymentLimiter } = require('../middleware/rateLimiter');
const idempotencyMiddleware = require('../middleware/idempotency');
const validate = require('../middleware/validatorHandler');
const {
  createPaymentOrderValidator,
  paymentWebhookValidator,
} = require('../validators/paymentValidators');

// Initialize payment order
router.post(
  '/order',
  authMiddleware,
  paymentLimiter,
  idempotencyMiddleware(600),
  createPaymentOrderValidator,
  validate,
  paymentController.createPaymentOrder
);

// Payment confirmation webhook
router.post(
  '/webhook',
  paymentWebhookValidator,
  validate,
  paymentController.processWebhook
);

module.exports = router;

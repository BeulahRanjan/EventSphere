/**
 * PaymentController for EventSphere.
 * Manages checkout orders and webhook processing with idempotency verification.
 */

const { paymentService } = require('../services');
const { sendSuccess } = require('../utils/response');

class PaymentController {
  async createPaymentOrder(req, res, next) {
    try {
      const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey;
      const result = await paymentService.createPaymentOrder(req.user._id, {
        ...req.body,
        idempotencyKey,
      });
      return sendSuccess(res, 'Payment order initialized', result, 201);
    } catch (error) {
      next(error);
    }
  }

  async processWebhook(req, res, next) {
    try {
      const signature = req.headers['x-payment-signature'] || req.headers['x-razorpay-signature'];
      const result = await paymentService.processPaymentWebhook({
        transactionId: req.body.transactionId,
        status: req.body.status,
        signature,
        rawPayload: req.body,
      });
      return sendSuccess(res, 'Payment processed successfully', result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PaymentController();

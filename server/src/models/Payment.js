/**
 * Payment Model for EventSphere.
 * Records financial transaction state, idempotency keys, and webhook receipts.
 */

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking reference is required'],
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REFUNDED'],
      default: 'PENDING',
      index: true,
    },
    paymentMethod: {
      type: String,
      default: 'UPI',
      enum: ['UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'NET_BANKING', 'WALLET'],
    },
    transactionId: {
      type: String,
      sparse: true,
      unique: true,
      index: true,
    },
    paymentGatewayOrderId: {
      type: String,
      index: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    failureReason: {
      type: String,
      default: null,
    },
    rawWebhookPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ user: 1, createdAt: -1 });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;

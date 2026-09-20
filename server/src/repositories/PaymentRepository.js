/**
 * PaymentRepository for financial ledger records and idempotency tracking.
 */

const BaseRepository = require('./BaseRepository');
const { Payment } = require('../models');

class PaymentRepository extends BaseRepository {
  constructor() {
    super(Payment);
  }

  async findByIdempotencyKey(idempotencyKey) {
    return this.model.findOne({ idempotencyKey });
  }

  async findByTransactionId(transactionId) {
    return this.model.findOne({ transactionId });
  }

  async findByBookingId(bookingId) {
    return this.model.findOne({ booking: bookingId }).sort({ createdAt: -1 });
  }

  async updatePaymentStatus(paymentId, status, details = {}, session = null) {
    const options = session ? { session, new: true } : { new: true };
    return this.model.findByIdAndUpdate(
      paymentId,
      {
        status,
        ...details,
      },
      options
    );
  }
}

module.exports = new PaymentRepository();

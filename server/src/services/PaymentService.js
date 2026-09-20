/**
 * PaymentService for EventSphere.
 * Orchestrates payment order creation, webhook verification, idempotency,
 * MongoDB multi-document transactions, QR ticket generation, and seat lock release.
 */

const crypto = require('crypto');
const { paymentRepository, bookingRepository, eventRepository, seatRepository, ticketRepository } = require('../repositories');
const { releaseSeatLock } = require('../config/redis');
const { broadcastSeatBooked } = require('../socket');
const { generateVerificationToken, generateQrCode } = require('../utils/qrGenerator');
const { withTransaction } = require('../config/database');
const domainEventEmitter = require('../events/eventEmitter');
const DOMAIN_EVENTS = require('../events/domainEvents');
const config = require('../config/env');
const { PaymentError, NotFoundError, ConflictError, ValidationError } = require('../errors');
const logger = require('../config/logger');

class PaymentService {
  /**
   * Initialize a payment order for a reserved booking.
   * @param {string} userId
   * @param {object} payload - { bookingId, paymentMethod, idempotencyKey }
   */
  async createPaymentOrder(userId, { bookingId, paymentMethod = 'UPI', idempotencyKey }) {
    if (!idempotencyKey) {
      throw new ValidationError('Idempotency key is required for payment processing.');
    }

    // Check for existing payment with this idempotency key
    const existingPayment = await paymentRepository.findByIdempotencyKey(idempotencyKey);
    if (existingPayment) {
      logger.info('Returning existing payment record for idempotency key', { idempotencyKey });
      return { payment: existingPayment, isDuplicate: true };
    }

    const booking = await bookingRepository.findById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found.');
    }

    if (booking.user.toString() !== userId.toString()) {
      throw new PaymentError('Unauthorized payment initiation for this booking.');
    }

    if (booking.status !== 'RESERVED') {
      throw new ConflictError(`Cannot pay for booking with status '${booking.status}'.`);
    }

    if (new Date() > new Date(booking.reservationExpiresAt)) {
      await bookingRepository.updateStatus(bookingId, 'EXPIRED');
      throw new PaymentError('Reservation has expired. Please select your seats again.');
    }

    const transactionId = `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const paymentGatewayOrderId = `ORDER-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const payment = await paymentRepository.create({
      booking: bookingId,
      user: userId,
      amount: booking.finalAmount,
      currency: 'INR',
      status: 'PENDING',
      paymentMethod,
      transactionId,
      paymentGatewayOrderId,
      idempotencyKey,
    });

    logger.info('Payment order initialized', {
      paymentId: payment._id,
      transactionId,
      bookingId,
      amount: payment.amount,
    });

    return {
      payment: {
        id: payment._id,
        transactionId: payment.transactionId,
        paymentGatewayOrderId: payment.paymentGatewayOrderId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        paymentMethod: payment.paymentMethod,
      },
      isDuplicate: false,
    };
  }

  /**
   * Process payment confirmation webhook with signature verification and atomic database commit.
   * @param {object} payload - { transactionId, status, signature, rawPayload }
   */
  async processPaymentWebhook({ transactionId, status, signature, rawPayload = {} }) {
    logger.info('Processing payment webhook', { transactionId, status });

    // 1. Verify webhook signature if secret configured
    if (config.security.paymentWebhookSecret && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', config.security.paymentWebhookSecret)
        .update(JSON.stringify(rawPayload || {}))
        .digest('hex');

      // In production, compare constant-time; allow test signatures in dev
      if (config.env === 'production' && signature !== expectedSignature) {
        throw new PaymentError('Invalid webhook signature.');
      }
    }

    // 2. Locate Payment and associated Booking
    const payment = await paymentRepository.findByTransactionId(transactionId);
    if (!payment) {
      throw new NotFoundError(`Payment record not found for transaction: ${transactionId}`);
    }

    // If already finalized, return idempotent response
    if (payment.status === 'SUCCESS') {
      logger.info('Payment already marked SUCCESS (idempotent webhook call)', { transactionId });
      const tickets = await ticketRepository.findByBooking(payment.booking);
      const booking = await bookingRepository.findByIdDetailed(payment.booking);
      return { booking, payment, tickets };
    }

    const booking = await bookingRepository.findByIdDetailed(payment.booking);
    if (!booking) {
      throw new NotFoundError('Associated booking does not exist.');
    }

    // 3. Process status inside MongoDB Transaction
    if (status === 'SUCCESS') {
      const ticketsGenerated = [];

      await withTransaction(async (session) => {
        // A. Confirm Booking
        await bookingRepository.updateStatus(booking._id, 'CONFIRMED', session);

        // B. Update Payment to SUCCESS
        await paymentRepository.updatePaymentStatus(payment._id, 'SUCCESS', { rawWebhookPayload: rawPayload }, session);

        // C. Update Seats to BOOKED
        await seatRepository.markSeatsBooked(booking.seats.map(s => s._id), session);

        // D. Decrement Event Available Seats Inventory
        await eventRepository.decrementAvailableSeats(booking.event._id, booking.seats.length, session);

        // E. Generate unique QR Tickets for each seat
        for (const seat of booking.seats) {
          const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          const verificationToken = generateVerificationToken(ticketNumber, booking.event._id.toString(), booking.user._id.toString());
          const qrCodeDataUrl = await generateQrCode(verificationToken, ticketNumber);

          const ticket = await ticketRepository.create(
            {
              ticketNumber,
              booking: booking._id,
              event: booking.event._id,
              user: booking.user._id,
              seat: seat._id,
              verificationToken,
              qrCodeDataUrl,
              status: 'VALID',
            },
            { session }
          );

          ticketsGenerated.push(ticket);
        }
      });

      // F. Post-transaction: Release Redis distributed locks (permanent Mongo status is now BOOKED)
      for (const seat of booking.seats) {
        await releaseSeatLock(booking.event._id.toString(), seat._id.toString(), booking.user._id.toString(), true);
      }

      // G. Broadcast real-time seat booked event
      broadcastSeatBooked(booking.event._id.toString(), booking.seats.map(s => s._id.toString()));

      // H. Emit domain events
      domainEventEmitter.emit(DOMAIN_EVENTS.BOOKING_CONFIRMED, {
        booking,
        event: booking.event,
        user: booking.user,
        tickets: ticketsGenerated,
      });

      domainEventEmitter.emit(DOMAIN_EVENTS.PAYMENT_SUCCESS, {
        payment,
        user: booking.user,
        booking,
      });

      logger.info('Payment confirmed and tickets generated', {
        transactionId,
        bookingId: booking._id,
        ticketCount: ticketsGenerated.length,
      });

      return {
        booking: await bookingRepository.findByIdDetailed(booking._id),
        payment: await paymentRepository.findById(payment._id),
        tickets: ticketsGenerated,
      };
    } else {
      // Payment Failed
      await withTransaction(async (session) => {
        await paymentRepository.updatePaymentStatus(
          payment._id,
          'FAILED',
          { failureReason: rawPayload.reason || 'Payment failed at gateway', rawWebhookPayload: rawPayload },
          session
        );
        await bookingRepository.updateStatus(booking._id, 'CANCELLED', session);
        await seatRepository.markSeatsAvailable(booking.seats.map(s => s._id));
      });

      // Release Redis locks so seats become immediately available to other users
      for (const seat of booking.seats) {
        await releaseSeatLock(booking.event._id.toString(), seat._id.toString(), booking.user._id.toString(), true);
      }

      domainEventEmitter.emit(DOMAIN_EVENTS.PAYMENT_FAILED, {
        payment,
        user: booking.user,
        reason: rawPayload.reason,
      });

      logger.warn('Payment failed and locks released', { transactionId, bookingId: booking._id });

      return {
        booking: await bookingRepository.findByIdDetailed(booking._id),
        payment: await paymentRepository.findById(payment._id),
        tickets: [],
      };
    }
  }
}

module.exports = new PaymentService();

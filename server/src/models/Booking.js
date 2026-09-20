/**
 * Booking Model for EventSphere.
 * Records reservation and confirmed states with expiration timestamps and idempotency keys.
 */

const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    bookingNumber: {
      type: String,
      required: [true, 'Booking number is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      index: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event is required'],
      index: true,
    },
    seats: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seat',
      required: true,
    }],
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    finalAmount: {
      type: Number,
      required: [true, 'Final amount is required'],
      min: 0,
    },
    status: {
      type: String,
      enum: ['RESERVED', 'CONFIRMED', 'CANCELLED', 'EXPIRED'],
      default: 'RESERVED',
      index: true,
    },
    reservationExpiresAt: {
      type: Date,
      required: [true, 'Reservation expiration date is required'],
      index: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      index: true,
    },
    cancellationReason: {
      type: String,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ event: 1, status: 1 });
bookingSchema.index({ status: 1, reservationExpiresAt: 1 });

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;

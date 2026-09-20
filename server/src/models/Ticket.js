/**
 * Ticket Model for EventSphere.
 * Stores single-use entry tokens, generated QR code data URLs, and attendance validation timestamps.
 */

const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      required: [true, 'Ticket number is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking reference is required'],
      index: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event reference is required'],
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    seat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seat',
      required: [true, 'Seat reference is required'],
    },
    verificationToken: {
      type: String,
      required: [true, 'Verification token is required'],
      unique: true,
      index: true,
    },
    qrCodeDataUrl: {
      type: String,
      required: [true, 'QR code image data is required'],
    },
    status: {
      type: String,
      enum: ['VALID', 'USED', 'CANCELLED'],
      default: 'VALID',
      index: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

ticketSchema.index({ user: 1, event: 1 });
ticketSchema.index({ event: 1, status: 1 });

const Ticket = mongoose.model('Ticket', ticketSchema);

module.exports = Ticket;

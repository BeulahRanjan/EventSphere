/**
 * Seat Model for EventSphere.
 * Manages physical and virtual seat states (AVAILABLE, LOCKED, BOOKED)
 * along with section tiers and price points.
 */

const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event ID is required'],
      index: true,
    },
    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Venue',
      required: [true, 'Venue ID is required'],
    },
    section: {
      type: String,
      required: [true, 'Section name is required'],
      trim: true,
    },
    row: {
      type: String,
      required: [true, 'Row identifier is required'],
      trim: true,
    },
    seatNumber: {
      type: Number,
      required: [true, 'Seat number is required'],
      min: 1,
    },
    tier: {
      type: String,
      enum: ['VIP', 'PREMIUM', 'REGULAR'],
      default: 'REGULAR',
    },
    price: {
      type: Number,
      required: [true, 'Seat price is required'],
      min: 0,
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'LOCKED', 'BOOKED'],
      default: 'AVAILABLE',
      index: true,
    },
    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lockExpiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index: No duplicate seat per event
seatSchema.index({ eventId: 1, section: 1, row: 1, seatNumber: 1 }, { unique: true });
// Fast query for all available seats in an event
seatSchema.index({ eventId: 1, status: 1 });

const Seat = mongoose.model('Seat', seatSchema);

module.exports = Seat;

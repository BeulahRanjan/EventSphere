/**
 * Venue Model for EventSphere.
 * Defines geographic physical locations, capacity, and section seating configurations.
 */

const mongoose = require('mongoose');

const venueSectionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    tier: {
      type: String,
      enum: ['VIP', 'PREMIUM', 'REGULAR'],
      default: 'REGULAR',
    },
    rows: {
      type: Number,
      required: true,
      min: 1,
    },
    seatsPerRow: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false }
);

const venueSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Venue name is required'],
      trim: true,
      index: true,
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      index: true,
    },
    state: {
      type: String,
      trim: true,
      default: '',
    },
    postalCode: {
      type: String,
      trim: true,
      default: '',
    },
    country: {
      type: String,
      trim: true,
      default: 'India',
    },
    totalCapacity: {
      type: Number,
      required: [true, 'Total capacity is required'],
      min: 1,
    },
    seatingLayout: {
      sections: [venueSectionSchema],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Index for city-based queries
venueSchema.index({ city: 1, name: 1 });

const Venue = mongoose.model('Venue', venueSchema);

module.exports = Venue;

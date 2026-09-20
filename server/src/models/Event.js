/**
 * Event Model for EventSphere.
 * Manages event lifecycle (DRAFT, PUBLISHED, CANCELLED, ARCHIVED),
 * ticketing pricing tiers, capacity, text badges, and compound search indexes.
 */

const mongoose = require('mongoose');

const pricingTierSchema = new mongoose.Schema(
  {
    tier: {
      type: String,
      enum: ['VIP', 'PREMIUM', 'REGULAR'],
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
    },
    availableCount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Event description is required'],
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EventCategory',
      required: [true, 'Event category is required'],
      index: true,
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Organizer is required'],
      index: true,
    },
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Venue',
      required: [true, 'Venue is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'PUBLISHED', 'CANCELLED', 'ARCHIVED'],
      default: 'DRAFT',
      index: true,
    },
    bannerUrl: {
      type: String,
      default: '',
    },
    images: {
      type: [String],
      default: [],
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
      index: true,
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    pricingTiers: [pricingTierSchema],
    totalCapacity: {
      type: Number,
      required: [true, 'Total capacity is required'],
      min: 1,
    },
    availableSeatsCount: {
      type: Number,
      required: true,
      min: 0,
      index: true,
    },
    cancellationPolicy: {
      type: String,
      default: 'Tickets can be cancelled up to 24 hours prior to event start for a 90% refund. Non-refundable within 24 hours.',
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    badges: {
      type: [String],
      enum: ['NEW', 'TRENDING', 'POPULAR', 'UPCOMING', 'SOLD OUT', 'LIVE', 'CANCELLED', 'BOOKED', 'LOCKED'],
      default: ['NEW'],
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    trendingScore: {
      type: Number,
      default: 0,
      index: true,
    },
    externalSource: {
      sourceName: { type: String, default: null },
      externalId: { type: String, default: null },
      rawData: { type: mongoose.Schema.Types.Mixed, default: null },
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for optimal read performance
eventSchema.index({ status: 1, startDate: 1 });
eventSchema.index({ category: 1, status: 1, startDate: 1 });
eventSchema.index({ status: 1, isFeatured: 1, trendingScore: -1 });
eventSchema.index({ title: 'text', description: 'text', tags: 'text' });

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;

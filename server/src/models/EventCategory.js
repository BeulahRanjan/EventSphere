/**
 * EventCategory Model for EventSphere.
 * Manages category classification (Music, Tech, Comedy, Sports, Theater, etc.).
 */

const mongoose = require('mongoose');

const eventCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    icon: {
      type: String,
      default: 'tag',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const EventCategory = mongoose.model('EventCategory', eventCategorySchema);

module.exports = EventCategory;

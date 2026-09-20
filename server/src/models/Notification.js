/**
 * Notification Model for EventSphere.
 * Manages user notifications, read receipts, and payload metadata.
 */

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    type: {
      type: String,
      enum: [
        'NEW_LOCAL_EVENT',
        'EVENT_PUBLISHED',
        'EVENT_UPDATED',
        'EVENT_CANCELLED',
        'EVENT_REMINDER',
        'BOOKING_CONFIRMED',
        'BOOKING_CANCELLED',
        'PAYMENT_SUCCESS',
        'PAYMENT_FAILED',
        'RECOMMENDED_EVENT',
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;

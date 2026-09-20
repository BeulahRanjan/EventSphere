/**
 * NotificationPreference Model for EventSphere.
 * Allows users to toggle channels and specific notification types.
 */

const mongoose = require('mongoose');

const notificationPreferenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    emailEnabled: {
      type: Boolean,
      default: true,
    },
    pushEnabled: {
      type: Boolean,
      default: true,
    },
    smsEnabled: {
      type: Boolean,
      default: false,
    },
    enabledTypes: {
      type: [String],
      default: [
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
    },
  },
  {
    timestamps: true,
  }
);

const NotificationPreference = mongoose.model('NotificationPreference', notificationPreferenceSchema);

module.exports = NotificationPreference;

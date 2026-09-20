/**
 * NotificationService for EventSphere.
 * Manages persisted user notifications, unread counters, and mark-as-read operations.
 */

const { notificationRepository } = require('../repositories');
const { NotFoundError } = require('../errors');
const logger = require('../config/logger');

class NotificationService {
  /**
   * Get user notifications with unread count.
   * @param {string} userId
   * @param {object} options - { page, limit, unreadOnly }
   */
  async getUserNotifications(userId, options = {}) {
    const [result, unreadCount] = await Promise.all([
      notificationRepository.findByUser(userId, options),
      notificationRepository.getUnreadCount(userId),
    ]);

    return {
      ...result,
      unreadCount,
    };
  }

  /**
   * Get unread notification count for a user.
   * @param {string} userId
   */
  async getUnreadCount(userId) {
    const count = await notificationRepository.getUnreadCount(userId);
    return { unreadCount: count };
  }

  /**
   * Mark a single notification as read.
   * @param {string} notificationId
   * @param {string} userId
   */
  async markAsRead(notificationId, userId) {
    const updated = await notificationRepository.markAsRead(notificationId, userId);
    if (!updated) {
      throw new NotFoundError('Notification not found.');
    }

    const unreadCount = await notificationRepository.getUnreadCount(userId);
    return { notification: updated, unreadCount };
  }

  /**
   * Mark all notifications as read for a user.
   * @param {string} userId
   */
  async markAllAsRead(userId) {
    await notificationRepository.markAllAsRead(userId);
    logger.info('Marked all notifications as read', { userId });
    return { unreadCount: 0 };
  }
}

module.exports = new NotificationService();

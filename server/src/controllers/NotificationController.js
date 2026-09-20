/**
 * NotificationController for EventSphere.
 * Manages user notifications, counts, and read status updates.
 */

const { notificationService } = require('../services');
const { sendSuccess } = require('../utils/response');

class NotificationController {
  async getUserNotifications(req, res, next) {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '20', 10);
      const unreadOnly = req.query.unreadOnly === 'true';

      const result = await notificationService.getUserNotifications(req.user._id, {
        page,
        limit,
        unreadOnly,
      });

      return sendSuccess(res, 'Notifications retrieved', result);
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req, res, next) {
    try {
      const result = await notificationService.getUnreadCount(req.user._id);
      return sendSuccess(res, 'Unread count retrieved', result);
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req, res, next) {
    try {
      const result = await notificationService.markAsRead(req.params.id, req.user._id);
      return sendSuccess(res, 'Notification marked as read', result);
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req, res, next) {
    try {
      const result = await notificationService.markAllAsRead(req.user._id);
      return sendSuccess(res, 'All notifications marked as read', result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new NotificationController();

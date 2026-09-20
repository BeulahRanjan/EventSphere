/**
 * NotificationRepository for notification feeds, counters, and read state persistence.
 */

const BaseRepository = require('./BaseRepository');
const { Notification } = require('../models');

class NotificationRepository extends BaseRepository {
  constructor() {
    super(Notification);
  }

  async findByUser(userId, { page = 1, limit = 20, unreadOnly = false }) {
    const filter = { user: userId };
    if (unreadOnly) {
      filter.isRead = false;
    }

    return this.paginate(filter, {
      page,
      limit,
      sort: { createdAt: -1 },
    });
  }

  async getUnreadCount(userId) {
    return this.model.countDocuments({ user: userId, isRead: false });
  }

  async markAsRead(notificationId, userId) {
    return this.model.findOneAndUpdate(
      { _id: notificationId, user: userId },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    );
  }

  async markAllAsRead(userId) {
    return this.model.updateMany(
      { user: userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
  }
}

module.exports = new NotificationRepository();

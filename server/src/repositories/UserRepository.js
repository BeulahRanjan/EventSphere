/**
 * UserRepository for managing User entity database queries.
 */

const BaseRepository = require('./BaseRepository');
const { User, NotificationPreference } = require('../models');

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  async findByEmailWithPassword(email) {
    return this.model.findOne({ email: email.toLowerCase() }).select('+password +refreshToken');
  }

  async findByEmail(email) {
    return this.model.findOne({ email: email.toLowerCase() });
  }

  async updateRefreshToken(userId, refreshToken) {
    return this.model.findByIdAndUpdate(userId, { refreshToken }, { new: true });
  }

  async getNotificationPreferences(userId) {
    let prefs = await NotificationPreference.findOne({ user: userId });
    if (!prefs) {
      prefs = await NotificationPreference.create({ user: userId });
    }
    return prefs;
  }

  async updateNotificationPreferences(userId, updateData) {
    return NotificationPreference.findOneAndUpdate(
      { user: userId },
      { $set: updateData },
      { new: true, upsert: true }
    );
  }

  async findUsersByLocationsOrCategories(locations = [], categoryIds = []) {
    const query = { isActive: true };
    const orConditions = [];

    if (locations && locations.length > 0) {
      orConditions.push({ preferredLocations: { $in: locations } });
    }
    if (categoryIds && categoryIds.length > 0) {
      orConditions.push({ preferredCategories: { $in: categoryIds } });
    }

    if (orConditions.length > 0) {
      query.$or = orConditions;
    }

    return this.model.find(query).select('_id email name role preferredLocations');
  }
}

module.exports = new UserRepository();

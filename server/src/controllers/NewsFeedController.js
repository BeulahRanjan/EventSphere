/**
 * NewsFeedController for EventSphere.
 * Manages local event discovery, announcements, and external feed ingestion.
 */

const { externalEventService, recommendationService } = require('../services');
const { sendSuccess } = require('../utils/response');

class NewsFeedController {
  async getFeed(req, res, next) {
    try {
      const userId = req.user ? req.user._id : null;
      const { city } = req.query;
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '10', 10);

      const feed = await externalEventService.getNewsFeed({ userId, city, page, limit });
      return sendSuccess(res, 'Event News Feed retrieved', feed);
    } catch (error) {
      next(error);
    }
  }

  async getRecommendations(req, res, next) {
    try {
      const userId = req.user ? req.user._id : null;
      const limit = parseInt(req.query.limit || '6', 10);
      const recommendations = await recommendationService.getRecommendations(userId, limit);
      return sendSuccess(res, 'Personalized recommendations retrieved', recommendations);
    } catch (error) {
      next(error);
    }
  }

  async ingestExternal(req, res, next) {
    try {
      const { events, sourceName } = req.body;
      const result = await externalEventService.ingestExternalEvents(events, sourceName, req.user._id);
      return sendSuccess(res, 'External events ingested into feed', result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new NewsFeedController();

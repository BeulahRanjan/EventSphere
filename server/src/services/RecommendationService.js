/**
 * RecommendationService for EventSphere.
 * Rule-based recommendation engine scoring events against user history,
 * geographic preference, and category affinity.
 */

const { eventRepository, bookingRepository, userRepository } = require('../repositories');
const logger = require('../config/logger');

class RecommendationService {
  /**
   * Generates personalized event recommendations for a user.
   * @param {string|null} userId
   * @param {number} limit
   */
  async getRecommendations(userId = null, limit = 6) {
    // Guest or unauthenticated fallback: return curated trending & upcoming events
    if (!userId) {
      return eventRepository.findTrending(limit);
    }

    try {
      const user = await userRepository.findById(userId);
      if (!user) {
        return eventRepository.findTrending(limit);
      }

      // Collect user affinity indicators
      const preferredCities = new Set(user.preferredLocations.map(c => c.toLowerCase()));
      const preferredCategoryIds = new Set(user.preferredCategories.map(c => c.toString()));

      // Inspect user's confirmed booking history
      const pastBookings = await bookingRepository.find({ user: userId, status: 'CONFIRMED' }, null, {
        populate: [{ path: 'event', populate: { path: 'venue' } }],
        limit: 20,
      });

      for (const booking of pastBookings) {
        if (booking.event) {
          if (booking.event.venue?.city) {
            preferredCities.add(booking.event.venue.city.toLowerCase());
          }
          if (booking.event.category) {
            preferredCategoryIds.add(booking.event.category.toString());
          }
        }
      }

      // Fetch upcoming published events
      const now = new Date();
      const candidateEvents = await eventRepository.find(
        { status: 'PUBLISHED', startDate: { $gte: now } },
        null,
        {
          populate: [{ path: 'category' }, { path: 'venue' }, { path: 'organizer', select: 'name' }],
          limit: 50,
        }
      );

      // Score each candidate event based on user affinity rules
      const scoredEvents = candidateEvents.map((event) => {
        let score = 0;
        const city = event.venue?.city ? event.venue.city.toLowerCase() : '';
        const categoryId = event.category?._id?.toString();

        // City Match (+40 points)
        if (preferredCities.has(city)) {
          score += 40;
        }

        // Category Match (+35 points)
        if (preferredCategoryIds.has(categoryId)) {
          score += 35;
        }

        // Popularity / Trending Factor (+ up to 25 points)
        score += Math.min(25, (event.trendingScore || 0) * 2);

        return { event, score };
      });

      // Sort descending by calculated score
      scoredEvents.sort((a, b) => b.score - a.score);

      const topEvents = scoredEvents.slice(0, limit).map(item => item.event);

      // If insufficient matches, backfill with trending events
      if (topEvents.length < limit) {
        const fallback = await eventRepository.findTrending(limit);
        const existingIds = new Set(topEvents.map(e => e._id.toString()));
        for (const item of fallback) {
          if (!existingIds.has(item._id.toString())) {
            topEvents.push(item);
            if (topEvents.length >= limit) break;
          }
        }
      }

      return topEvents;
    } catch (error) {
      logger.error('Error generating recommendations, falling back to trending', { error: error.message });
      return eventRepository.findTrending(limit);
    }
  }
}

module.exports = new RecommendationService();

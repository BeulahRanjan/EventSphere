/**
 * ExternalEventService & Event News Feed for EventSphere.
 * Provides validation and normalization for external data feeds,
 * and compiles the high-throughput, aggregated Event News Feed.
 */

const { eventRepository, venueRepository, categoryRepository, userRepository } = require('../repositories');
const { redisClient } = require('../config/redis');
const recommendationService = require('./RecommendationService');
const eventService = require('./EventService');
const logger = require('../config/logger');

class ExternalEventService {
  /**
   * Controlled normalization and ingestion pipeline:
   * External Event Source → Validate/Normalize → Event Service → Repository → MongoDB → Event Feed
   * @param {Array<object>} rawEvents
   * @param {string} sourceName
   * @param {string} systemOrganizerId
   */
  async ingestExternalEvents(rawEvents, sourceName = 'CityEventsHub', systemOrganizerId) {
    if (!Array.isArray(rawEvents)) return { ingested: 0, errors: [] };

    let ingestedCount = 0;
    const errors = [];

    // Pre-fetch default categories
    const categories = await categoryRepository.findActiveCategories();
    const defaultCategory = categories[0] || (await categoryRepository.create({ name: 'General', slug: 'general' }));

    for (const item of rawEvents) {
      try {
        // Step 1: Validate Schema
        if (!item.title || !item.startDate || !item.city) {
          throw new Error('Missing required fields: title, startDate, or city.');
        }

        // Check if already ingested
        const existing = await eventRepository.findOne({
          'externalSource.externalId': item.id || item.externalId,
          'externalSource.sourceName': sourceName,
        });
        if (existing) continue;

        // Step 2: Ensure Venue exists
        let venue = await venueRepository.findOne({ name: item.venueName || `${item.city} Convention Arena`, city: item.city });
        if (!venue) {
          venue = await venueRepository.create({
            name: item.venueName || `${item.city} Convention Arena`,
            address: item.address || 'Central District Arena',
            city: item.city,
            totalCapacity: 50,
            createdBy: systemOrganizerId,
          });
        }

        // Step 3: Normalize Data
        const normalizedData = {
          title: item.title.trim(),
          description: item.description || `Live official event hosted in ${item.city}.`,
          category: item.categoryId || defaultCategory._id,
          venue: venue._id,
          startDate: new Date(item.startDate),
          endDate: item.endDate ? new Date(item.endDate) : new Date(new Date(item.startDate).getTime() + 3 * 3600 * 1000),
          status: 'PUBLISHED',
          totalCapacity: 50,
          availableSeatsCount: 50,
          bannerUrl: item.bannerUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
          pricingTiers: [
            { tier: 'REGULAR', price: item.price || 499, capacity: 50, availableCount: 50 }
          ],
          badges: ['NEW'],
          externalSource: {
            sourceName,
            externalId: item.id || item.externalId || `ext-${Date.now()}`,
            rawData: item,
          },
        };

        // Step 4: Dispatch via EventService
        await eventService.createEvent(systemOrganizerId, normalizedData);
        ingestedCount++;
      } catch (err) {
        errors.push({ title: item.title, error: err.message });
        logger.warn('External event normalization failure', { item, error: err.message });
      }
    }

    logger.info('External event ingestion completed', { sourceName, ingestedCount, errorsCount: errors.length });
    return { ingested: ingestedCount, errors };
  }

  /**
   * Retrieves the comprehensive Event News Feed.
   * Surfaces: Local city events, trending events, popular highlights, announcements, and recommendations.
   * Uses Redis caching with a 5-minute TTL.
   */
  async getNewsFeed({ userId = null, city = null, page = 1, limit = 10 }) {
    // Determine effective target city from user preferences if not provided
    let targetCity = city;
    if (!targetCity && userId) {
      const user = await userRepository.findById(userId);
      if (user && user.preferredLocations && user.preferredLocations.length > 0) {
        targetCity = user.preferredLocations[0];
      }
    }

    const cacheKey = `events:feed:${targetCity || 'all'}:${userId || 'guest'}:${page}:${limit}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Parallel fetch: Local events, Trending, Upcoming, and Recommendations
    const [localEventsResult, trending, upcoming, recommendations] = await Promise.all([
      eventRepository.searchAndFilter({
        city: targetCity,
        status: 'PUBLISHED',
        page,
        limit,
        sortBy: 'newest',
      }),
      eventRepository.findTrending(4),
      eventRepository.findUpcoming(4),
      recommendationService.getRecommendations(userId, 4),
    ]);

    // Build curated feed sections
    const newsFeed = {
      location: targetCity || 'All Locations',
      localHighlights: localEventsResult.items,
      trending,
      upcoming,
      recommended: recommendations,
      pagination: {
        page: localEventsResult.page,
        totalPages: localEventsResult.totalPages,
        total: localEventsResult.total,
      },
      generatedAt: new Date(),
    };

    // Cache feed for 5 minutes (300 seconds)
    await redisClient.set(cacheKey, JSON.stringify(newsFeed), 'EX', 300);

    return newsFeed;
  }
}

module.exports = new ExternalEventService();

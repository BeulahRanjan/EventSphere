/**
 * EventService for EventSphere.
 * Manages event lifecycle, automated seat inventory generation, cache-aside querying,
 * and domain event dispatching.
 */

const { eventRepository, venueRepository, seatRepository, categoryRepository } = require('../repositories');
const { redisClient, invalidateCachePattern } = require('../config/redis');
const domainEventEmitter = require('../events/eventEmitter');
const DOMAIN_EVENTS = require('../events/domainEvents');
const { NotFoundError, ForbiddenError, ValidationError } = require('../errors');
const logger = require('../config/logger');

class EventService {
  /**
   * Create a new event with associated venue seats.
   * @param {string} organizerId
   * @param {object} eventData
   */
  async createEvent(organizerId, eventData) {
    // 1. Verify venue
    const venue = await venueRepository.findById(eventData.venue);
    if (!venue) {
      throw new NotFoundError('Selected venue does not exist.');
    }

    // 2. Generate URL slug
    const slugBase = eventData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    const slug = `${slugBase}-${Date.now().toString(36)}`;

    // 3. Compute capacity and available seats
    let totalCapacity = eventData.totalCapacity || venue.totalCapacity;
    let availableSeatsCount = totalCapacity;

    const event = await eventRepository.create({
      ...eventData,
      organizer: organizerId,
      slug,
      totalCapacity,
      availableSeatsCount,
    });

    // 4. Generate seats in Seat collection based on venue layout
    const seatsToInsert = [];
    if (venue.seatingLayout && venue.seatingLayout.sections && venue.seatingLayout.sections.length > 0) {
      for (const section of venue.seatingLayout.sections) {
        // Find matching pricing tier or default to 500
        const tierConfig = eventData.pricingTiers?.find(t => t.tier === section.tier);
        const price = tierConfig ? tierConfig.price : 499;

        for (let r = 1; r <= section.rows; r++) {
          const rowLetter = String.fromCharCode(64 + r); // A, B, C...
          for (let s = 1; s <= section.seatsPerRow; s++) {
            seatsToInsert.push({
              eventId: event._id,
              venueId: venue._id,
              section: section.name,
              row: rowLetter,
              seatNumber: s,
              tier: section.tier || 'REGULAR',
              price,
              status: 'AVAILABLE',
            });
          }
        }
      }
    } else {
      // Fallback standard seating layout: 5 rows of 10 seats
      for (let r = 1; r <= 5; r++) {
        const rowLetter = String.fromCharCode(64 + r);
        for (let s = 1; s <= 10; s++) {
          seatsToInsert.push({
            eventId: event._id,
            venueId: venue._id,
            section: 'General Section',
            row: rowLetter,
            seatNumber: s,
            tier: r === 1 ? 'VIP' : (r <= 3 ? 'PREMIUM' : 'REGULAR'),
            price: r === 1 ? 1499 : (r <= 3 ? 999 : 499),
            status: 'AVAILABLE',
          });
        }
      }
    }

    if (seatsToInsert.length > 0) {
      await seatRepository.insertMany(seatsToInsert);
      // Synchronize exact total seat capacity
      await eventRepository.updateById(event._id, {
        totalCapacity: seatsToInsert.length,
        availableSeatsCount: seatsToInsert.length,
      });
    }

    logger.info('Event created with generated seats', { eventId: event._id, seatCount: seatsToInsert.length });

    if (event.status === 'PUBLISHED') {
      const detailedEvent = await eventRepository.findByIdDetailed(event._id);
      domainEventEmitter.emit(DOMAIN_EVENTS.EVENT_PUBLISHED, detailedEvent);
    }

    return eventRepository.findByIdDetailed(event._id);
  }

  /**
   * Search and filter events with cache-aside support.
   */
  async getEvents(filters) {
    return eventRepository.searchAndFilter(filters);
  }

  /**
   * Get single event by slug with Redis caching.
   * @param {string} slug
   */
  async getEventBySlug(slug) {
    const cacheKey = `event:slug:${slug}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const event = await eventRepository.findBySlug(slug);
    if (!event) {
      throw new NotFoundError('Event not found.');
    }

    await redisClient.set(cacheKey, JSON.stringify(event), 'EX', 1800); // 30 min TTL
    return event;
  }

  /**
   * Get single event by ID with Redis caching.
   * @param {string} id
   */
  async getEventById(id) {
    const cacheKey = `event:${id}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const event = await eventRepository.findByIdDetailed(id);
    if (!event) {
      throw new NotFoundError('Event not found.');
    }

    await redisClient.set(cacheKey, JSON.stringify(event), 'EX', 1800);
    return event;
  }

  /**
   * Update event details and invalidate caches.
   */
  async updateEvent(eventId, userId, userRole, updateData) {
    const event = await eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found.');
    }

    if (userRole !== 'ADMIN' && event.organizer.toString() !== userId.toString()) {
      throw new ForbiddenError('You are not authorized to update this event.');
    }

    const updated = await eventRepository.updateById(eventId, updateData);

    // Invalidate caches
    await Promise.all([
      invalidateCachePattern(`event:${eventId}*`),
      invalidateCachePattern(`event:slug:${event.slug}*`),
      invalidateCachePattern('events:*'),
    ]);

    domainEventEmitter.emit(DOMAIN_EVENTS.EVENT_UPDATED, updated);
    return eventRepository.findByIdDetailed(eventId);
  }

  /**
   * Publish an event.
   */
  async publishEvent(eventId, userId, userRole) {
    const event = await eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found.');
    }

    if (userRole !== 'ADMIN' && event.organizer.toString() !== userId.toString()) {
      throw new ForbiddenError('You are not authorized to publish this event.');
    }

    const updated = await eventRepository.updateById(eventId, { status: 'PUBLISHED' });
    const detailed = await eventRepository.findByIdDetailed(eventId);

    domainEventEmitter.emit(DOMAIN_EVENTS.EVENT_PUBLISHED, detailed);
    return detailed;
  }

  /**
   * Cancel an event and notify booked users.
   */
  async cancelEvent(eventId, userId, userRole, reason) {
    const event = await eventRepository.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found.');
    }

    if (userRole !== 'ADMIN' && event.organizer.toString() !== userId.toString()) {
      throw new ForbiddenError('You are not authorized to cancel this event.');
    }

    const updated = await eventRepository.updateById(eventId, {
      status: 'CANCELLED',
      cancellationPolicy: reason || 'Event cancelled by organizer.',
    });

    domainEventEmitter.emit(DOMAIN_EVENTS.EVENT_CANCELLED, updated);
    return updated;
  }

  /**
   * Get trending events (Redis cache-aside with 15-minute TTL).
   */
  async getTrendingEvents(limit = 6) {
    const cacheKey = `events:trending:${limit}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const events = await eventRepository.findTrending(limit);
    await redisClient.set(cacheKey, JSON.stringify(events), 'EX', 900); // 15 mins
    return events;
  }

  /**
   * Get upcoming events (Redis cache-aside with 15-minute TTL).
   */
  async getUpcomingEvents(limit = 6) {
    const cacheKey = `events:upcoming:${limit}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const events = await eventRepository.findUpcoming(limit);
    await redisClient.set(cacheKey, JSON.stringify(events), 'EX', 900);
    return events;
  }

  /**
   * Get popular events (Redis cache-aside with 15-minute TTL).
   */
  async getPopularEvents(limit = 6) {
    const cacheKey = `events:popular:${limit}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const events = await eventRepository.findPopular(limit);
    await redisClient.set(cacheKey, JSON.stringify(events), 'EX', 900);
    return events;
  }

  /**
   * Get all events created by a specific organizer.
   */
  async getOrganizerEvents(organizerId) {
    return eventRepository.findByOrganizer(organizerId);
  }
}

module.exports = new EventService();

/**
 * EventController for EventSphere.
 * Handles event catalog retrieval, creation, updates, and category queries.
 */

const { eventService } = require('../services');
const { categoryRepository, venueRepository } = require('../repositories');
const { sendSuccess } = require('../utils/response');

class EventController {
  async createEvent(req, res, next) {
    try {
      const event = await eventService.createEvent(req.user._id, req.body);
      return sendSuccess(res, 'Event created successfully', event, 201);
    } catch (error) {
      next(error);
    }
  }

  async getEvents(req, res, next) {
    try {
      const result = await eventService.getEvents(req.query);
      return sendSuccess(res, 'Events retrieved', result);
    } catch (error) {
      next(error);
    }
  }

  async getEventBySlug(req, res, next) {
    try {
      const event = await eventService.getEventBySlug(req.params.slug);
      return sendSuccess(res, 'Event retrieved', event);
    } catch (error) {
      next(error);
    }
  }

  async getEventById(req, res, next) {
    try {
      const event = await eventService.getEventById(req.params.id);
      return sendSuccess(res, 'Event retrieved', event);
    } catch (error) {
      next(error);
    }
  }

  async updateEvent(req, res, next) {
    try {
      const event = await eventService.updateEvent(req.params.id, req.user._id, req.user.role, req.body);
      return sendSuccess(res, 'Event updated successfully', event);
    } catch (error) {
      next(error);
    }
  }

  async publishEvent(req, res, next) {
    try {
      const event = await eventService.publishEvent(req.params.id, req.user._id, req.user.role);
      return sendSuccess(res, 'Event published successfully', event);
    } catch (error) {
      next(error);
    }
  }

  async cancelEvent(req, res, next) {
    try {
      const { reason } = req.body;
      const event = await eventService.cancelEvent(req.params.id, req.user._id, req.user.role, reason);
      return sendSuccess(res, 'Event cancelled successfully', event);
    } catch (error) {
      next(error);
    }
  }

  async getTrendingEvents(req, res, next) {
    try {
      const limit = parseInt(req.query.limit || '6', 10);
      const events = await eventService.getTrendingEvents(limit);
      return sendSuccess(res, 'Trending events retrieved', events);
    } catch (error) {
      next(error);
    }
  }

  async getUpcomingEvents(req, res, next) {
    try {
      const limit = parseInt(req.query.limit || '6', 10);
      const events = await eventService.getUpcomingEvents(limit);
      return sendSuccess(res, 'Upcoming events retrieved', events);
    } catch (error) {
      next(error);
    }
  }

  async getPopularEvents(req, res, next) {
    try {
      const limit = parseInt(req.query.limit || '6', 10);
      const events = await eventService.getPopularEvents(limit);
      return sendSuccess(res, 'Popular events retrieved', events);
    } catch (error) {
      next(error);
    }
  }

  async getOrganizerEvents(req, res, next) {
    try {
      const events = await eventService.getOrganizerEvents(req.user._id);
      return sendSuccess(res, 'Organizer events retrieved', events);
    } catch (error) {
      next(error);
    }
  }

  async getCategories(req, res, next) {
    try {
      const categories = await categoryRepository.findActiveCategories();
      return sendSuccess(res, 'Categories retrieved', categories);
    } catch (error) {
      next(error);
    }
  }

  async getVenues(req, res, next) {
    try {
      const venues = await venueRepository.find();
      return sendSuccess(res, 'Venues retrieved', venues);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new EventController();

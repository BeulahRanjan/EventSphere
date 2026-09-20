/**
 * Event Routes for EventSphere.
 */

const express = require('express');
const router = express.Router();
const eventController = require('../controllers/EventController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/rbacMiddleware');
const validate = require('../middleware/validatorHandler');
const {
  createEventValidator,
  updateEventValidator,
  searchEventsValidator,
} = require('../validators/eventValidators');

// Public catalog routes
router.get('/', searchEventsValidator, validate, eventController.getEvents);
router.get('/trending', eventController.getTrendingEvents);
router.get('/upcoming', eventController.getUpcomingEvents);
router.get('/popular', eventController.getPopularEvents);
router.get('/categories', eventController.getCategories);
router.get('/venues', eventController.getVenues);
router.get('/slug/:slug', eventController.getEventBySlug);
router.get('/:id', eventController.getEventById);

// Organizer protected routes
router.get(
  '/organizer/my-events',
  authMiddleware,
  authorizeRoles('EVENT_ORGANIZER', 'ADMIN'),
  eventController.getOrganizerEvents
);

router.post(
  '/',
  authMiddleware,
  authorizeRoles('EVENT_ORGANIZER', 'ADMIN'),
  createEventValidator,
  validate,
  eventController.createEvent
);

router.put(
  '/:id',
  authMiddleware,
  authorizeRoles('EVENT_ORGANIZER', 'ADMIN'),
  updateEventValidator,
  validate,
  eventController.updateEvent
);

router.post(
  '/:id/publish',
  authMiddleware,
  authorizeRoles('EVENT_ORGANIZER', 'ADMIN'),
  eventController.publishEvent
);

router.post(
  '/:id/cancel',
  authMiddleware,
  authorizeRoles('EVENT_ORGANIZER', 'ADMIN'),
  eventController.cancelEvent
);

module.exports = router;

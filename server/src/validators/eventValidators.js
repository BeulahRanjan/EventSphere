/**
 * Event input validation schemas using express-validator.
 */

const { body, query, param } = require('express-validator');

const createEventValidator = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Event title is required.')
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters.'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required.'),
  body('category')
    .isMongoId()
    .withMessage('Valid category ID is required.'),
  body('venue')
    .isMongoId()
    .withMessage('Valid venue ID is required.'),
  body('startDate')
    .isISO8601()
    .withMessage('Start date must be a valid ISO8601 date string.'),
  body('endDate')
    .isISO8601()
    .withMessage('End date must be a valid ISO8601 date string.'),
  body('pricingTiers')
    .optional()
    .isArray()
    .withMessage('Pricing tiers must be an array.'),
];

const updateEventValidator = [
  param('id').isMongoId().withMessage('Invalid event ID.'),
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty.'),
  body('description').optional().trim().notEmpty().withMessage('Description cannot be empty.'),
  body('startDate').optional().isISO8601().withMessage('Invalid start date.'),
  body('endDate').optional().isISO8601().withMessage('Invalid end date.'),
];

const searchEventsValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100.'),
  query('minPrice').optional().isNumeric().withMessage('Min price must be a number.'),
  query('maxPrice').optional().isNumeric().withMessage('Max price must be a number.'),
  query('sortBy').optional().isIn(['startDate', 'price', 'trending', 'popular', 'newest']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
];

module.exports = {
  createEventValidator,
  updateEventValidator,
  searchEventsValidator,
};

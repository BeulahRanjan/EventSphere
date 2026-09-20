/**
 * Auth input validation schemas using express-validator.
 */

const { body } = require('express-validator');

const registerValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required.')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters.'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long.'),
  body('role')
    .optional()
    .isIn(['USER', 'EVENT_ORGANIZER'])
    .withMessage('Role must be either USER or EVENT_ORGANIZER.'),
  body('phone')
    .optional()
    .trim(),
  body('preferredLocations')
    .optional()
    .isArray()
    .withMessage('Preferred locations must be an array of city names.'),
];

const loginValidator = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required.'),
];

const refreshTokenValidator = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required.'),
];

const updateProfileValidator = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty.'),
  body('phone')
    .optional()
    .trim(),
  body('preferredLocations')
    .optional()
    .isArray()
    .withMessage('Preferred locations must be an array of strings.'),
  body('preferredCategories')
    .optional()
    .isArray()
    .withMessage('Preferred categories must be an array of category IDs.'),
];

module.exports = {
  registerValidator,
  loginValidator,
  refreshTokenValidator,
  updateProfileValidator,
};

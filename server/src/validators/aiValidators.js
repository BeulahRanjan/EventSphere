/**
 * AI Assistant input validation schema.
 */

const { body } = require('express-validator');

const queryAiValidator = [
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required.')
    .isLength({ max: 500 })
    .withMessage('Message cannot exceed 500 characters.'),
  body('conversationId')
    .optional()
    .trim(),
];

module.exports = {
  queryAiValidator,
};

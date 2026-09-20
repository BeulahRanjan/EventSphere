/**
 * Express-validator evaluation middleware for EventSphere.
 * Formats validation errors cleanly and hands off to centralized error handler.
 */

const { validationResult } = require('express-validator');
const { ValidationError } = require('../errors');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    }));

    return next(new ValidationError('Input validation failed', formattedErrors));
  }
  next();
}

module.exports = validate;

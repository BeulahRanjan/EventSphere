/**
 * Centralized Error Handling Middleware for EventSphere.
 * Intercepts all operational and unhandled exceptions, maps database/system errors,
 * logs structured diagnostics, and returns standardized client JSON.
 */

const { AppError, ValidationError, ConflictError } = require('../errors');
const logger = require('../config/logger');
const config = require('../config/env');

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  let error = err;

  // Handle Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    error = new ValidationError(`Invalid format for field: ${err.path}`);
  }

  // Handle Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    error = new ConflictError(`A resource with that ${field} already exists.`);
  }

  // Handle Mongoose Schema ValidationError
  if (err.name === 'ValidationError' && !(err instanceof AppError)) {
    const messages = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    error = new ValidationError('Database validation failed', messages);
  }

  // Handle JSON parse errors from express.json()
  if (err.type === 'entity.parse.failed') {
    error = new ValidationError('Malformed JSON payload in request body');
  }

  const statusCode = error.statusCode || 500;
  const message = error.isOperational ? error.message : 'Internal server error';

  // Log error with structured details
  if (statusCode >= 500) {
    logger.error('Unhandled Server Exception', {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      user: req.user ? req.user._id : null,
    });
  } else {
    logger.warn('Operational Request Error', {
      statusCode,
      message: error.message,
      errors: error.errors,
      url: req.originalUrl,
      method: req.method,
    });
  }

  const responsePayload = {
    success: false,
    message,
  };

  if (error.errors) {
    responsePayload.errors = error.errors;
  }

  // Never expose raw stack traces in production
  if (config.env === 'development' && statusCode >= 500) {
    responsePayload.stack = err.stack;
  }

  res.status(statusCode).json(responsePayload);
}

module.exports = errorHandler;

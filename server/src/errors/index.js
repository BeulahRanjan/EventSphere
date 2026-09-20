/**
 * Centralized custom error classes for EventSphere.
 * Provides standardized HTTP status codes, operational flags, and error context.
 */

class AppError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class AuthError extends AppError {
  constructor(message = 'Authentication failed. Please log in.', errors = null) {
    super(message, 401, errors);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden. Insufficient permissions.', errors = null) {
    super(message, 403, errors);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors = null) {
    super(message, 400, errors);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Requested resource was not found') {
    super(message, 404);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict occurred', errors = null) {
    super(message, 409, errors);
  }
}

class SeatUnavailableError extends AppError {
  constructor(message = 'One or more requested seats are locked or already booked', errors = null) {
    super(message, 409, errors);
  }
}

class PaymentError extends AppError {
  constructor(message = 'Payment processing failed', errors = null) {
    super(message, 402, errors);
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', errors = null) {
    super(message, 500, errors);
  }
}

class ExternalApiError extends AppError {
  constructor(message = 'External API communication error', errors = null) {
    super(message, 502, errors);
  }
}

class AiError extends AppError {
  constructor(message = 'AI assistant processing error', errors = null) {
    super(message, 500, errors);
  }
}

module.exports = {
  AppError,
  AuthError,
  ForbiddenError,
  ValidationError,
  NotFoundError,
  ConflictError,
  SeatUnavailableError,
  PaymentError,
  DatabaseError,
  ExternalApiError,
  AiError,
};

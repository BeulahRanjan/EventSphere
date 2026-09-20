/**
 * Express Application Setup for EventSphere.
 * Configures security headers, CORS, body parsers, routes, and centralized error handling.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const config = require('./config/env');
const logger = require('./config/logger');
const errorHandler = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');
const { NotFoundError } = require('./errors');
const apiRoutes = require('./routes');

const app = express();

// Security HTTP Headers
app.use(helmet());

// CORS Configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (
        config.security.corsOrigins.includes(origin) ||
        config.security.corsOrigins.includes('*') ||
        config.env === 'development'
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy violation for origin: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Idempotency-Key', 'X-Payment-Signature'],
  })
);

// Morgan HTTP request logging bridged to Winston
const morganStream = {
  write: (message) => logger.info(message.trim()),
};
app.use(morgan(':method :url :status :res[content-length] - :response-time ms', { stream: morganStream }));

// Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// General rate limiter
app.use('/api', generalLimiter);

// API Routes
app.use('/api/v1', apiRoutes);

// Catch 404
app.use((req, res, next) => {
  next(new NotFoundError(`Resource not found: ${req.method} ${req.originalUrl}`));
});

// Centralized error handler
app.use(errorHandler);

module.exports = app;

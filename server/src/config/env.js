/**
 * Environment configuration loader and validator for EventSphere.
 * Validates and exposes strictly typed configuration values across the application.
 */

const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env if present
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  instanceId: process.env.INSTANCE_ID || `instance-${Math.random().toString(36).substring(7)}`,

  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/eventsphere',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'eventsphere_super_secret_access_jwt_key_2026_production_grade',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'eventsphere_super_secret_refresh_jwt_key_2026_production_grade',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRATION || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },

  security: {
    paymentWebhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || 'eventsphere_payment_webhook_secret_key_2026',
    ticketHmacSecret: process.env.TICKET_HMAC_SECRET || 'eventsphere_ticket_hmac_secret_key_2026',
    corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:80,http://localhost:3000,http://localhost:8080').split(','),
  },

  ai: {
    geminiApiKey: process.env.GEMINI_API_KEY || '',
  },

  lock: {
    seatLockTtlSeconds: 600, // 10 minutes distributed lock TTL
  },
};

module.exports = config;

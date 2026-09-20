/**
 * Production-grade structured Winston logger for EventSphere.
 * Provides INFO, WARN, ERROR, and DEBUG levels with automatic redaction of sensitive credentials.
 */

const winston = require('winston');
const config = require('./env');

// Keys whose values must never appear in log output
const SENSITIVE_KEYS = [
  'password',
  'token',
  'refreshtoken',
  'accesstoken',
  'secret',
  'authorization',
  'creditcard',
  'cardnumber',
  'cvv',
  'apikey',
  'key'
];

/**
 * Recursively redacts sensitive keys from log metadata objects.
 */
function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some(sensitive => lowerKey.includes(sensitive))) {
      clean[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      clean[key] = sanitize(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

const redactFormat = winston.format((info) => {
  return sanitize(info);
});

const logger = winston.createLogger({
  level: config.env === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    redactFormat(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: config.env !== 'production' }),
    winston.format.json()
  ),
  defaultMeta: { service: 'eventsphere-api', instance: config.instanceId },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        redactFormat(),
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, service, instance, ...meta }) => {
          const metaString = Object.keys(meta).length ? ` | ${JSON.stringify(meta)}` : '';
          return `[${timestamp}] [${level}] [${instance}]: ${message}${metaString}`;
        })
      )
    })
  ]
});

module.exports = logger;

/**
 * Idempotency Middleware for EventSphere.
 * Prevents double-processing of payments and critical booking operations.
 */

const { redisClient } = require('../config/redis');
const logger = require('../config/logger');
const { ConflictError } = require('../errors');

/**
 * Ensures requests with the same Idempotency-Key header are executed exactly once.
 * Subsequent identical requests return the cached result.
 */
function idempotencyMiddleware(ttlSeconds = 86400) {
  return async (req, res, next) => {
    const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

    // If no idempotency key is passed, continue normally
    if (!idempotencyKey) {
      return next();
    }

    const redisKey = `idempotency:${idempotencyKey}`;

    try {
      // Check if key already exists in Redis
      const existing = await redisClient.get(redisKey);

      if (existing) {
        const record = JSON.parse(existing);

        if (record.status === 'PROCESSING') {
          logger.warn('Duplicate request detected while previous is still processing', { idempotencyKey });
          return next(
            new ConflictError('A request with this idempotency key is currently processing. Please wait.')
          );
        }

        if (record.status === 'COMPLETED') {
          logger.info('Returning cached response for idempotency key', { idempotencyKey });
          res.setHeader('X-Cache-Lookup', 'HIT');
          res.setHeader('X-Idempotent-Replay', 'true');
          return res.status(record.statusCode).json(record.body);
        }
      }

      // Mark as PROCESSING with 10-minute hold
      await redisClient.set(
        redisKey,
        JSON.stringify({ status: 'PROCESSING', startedAt: Date.now() }),
        'EX',
        600
      );

      // Intercept res.json to cache response payload on completion
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        // Only cache successful or definitive terminal responses
        if (res.statusCode >= 200 && res.statusCode < 500) {
          redisClient.set(
            redisKey,
            JSON.stringify({
              status: 'COMPLETED',
              statusCode: res.statusCode,
              body,
              completedAt: Date.now(),
            }),
            'EX',
            ttlSeconds
          ).catch((err) => {
            logger.error('Failed to cache idempotency result', { error: err.message });
          });
        } else {
          // If server error occurred, release lock so user can safely retry
          redisClient.del(redisKey).catch(() => {});
        }

        return originalJson(body);
      };

      next();
    } catch (error) {
      logger.error('Idempotency middleware error, continuing execution', { error: error.message });
      next();
    }
  };
}

module.exports = idempotencyMiddleware;

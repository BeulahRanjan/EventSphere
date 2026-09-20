/**
 * Redis-backed Sliding Window Rate Limiter for EventSphere.
 * Protects critical endpoints against brute-force and DDoS attacks.
 */

const { redisClient } = require('../config/redis');
const logger = require('../config/logger');

/**
 * Creates a rate limiting middleware using Redis sliding-window algorithm.
 * @param {object} options
 * @param {number} options.windowSeconds - Duration of rate window (default 60s)
 * @param {number} options.maxRequests - Max allowed requests within window
 * @param {string} options.keyPrefix - Prefix for Redis key
 * @param {string} options.message - Custom rejection message
 */
function createRateLimiter({
  windowSeconds = 60,
  maxRequests = 60,
  keyPrefix = 'rl',
  message = 'Too many requests. Please slow down and try again later.',
}) {
  return async (req, res, next) => {
    try {
      const identifier = req.user ? `user:${req.user._id}` : `ip:${req.ip || req.connection.remoteAddress}`;
      const key = `ratelimit:${keyPrefix}:${identifier}`;
      const now = Date.now();
      const clearBefore = now - windowSeconds * 1000;

      // Pipeline Redis commands for atomic sliding window evaluation
      const multi = redisClient.multi();
      multi.zremrangebyscore(key, 0, clearBefore);
      multi.zadd(key, now, `${now}:${Math.random()}`);
      multi.zcard(key);
      multi.expire(key, windowSeconds);

      const results = await multi.exec();
      const currentCount = results[2][1];

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - currentCount));
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowSeconds * 1000) / 1000));

      if (currentCount > maxRequests) {
        logger.warn('Rate limit exceeded', {
          prefix: keyPrefix,
          identifier,
          currentCount,
          maxRequests,
        });

        return res.status(429).json({
          success: false,
          message,
          errors: [{ field: 'rateLimit', message: `Exceeded ${maxRequests} requests per ${windowSeconds}s` }],
        });
      }

      next();
    } catch (error) {
      // Fail open if Redis is temporarily unreachable so service remains available
      logger.error('Rate limiter Redis error, failing open', { error: error.message });
      next();
    }
  };
}

// Pre-configured rate limiters for specific critical endpoints
const authLimiter = createRateLimiter({
  windowSeconds: 60,
  maxRequests: 10,
  keyPrefix: 'auth',
  message: 'Too many authentication attempts. Please try again after 1 minute.',
});

const bookingLimiter = createRateLimiter({
  windowSeconds: 60,
  maxRequests: 20,
  keyPrefix: 'booking',
  message: 'Booking request rate limit reached. Please wait a moment.',
});

const paymentLimiter = createRateLimiter({
  windowSeconds: 60,
  maxRequests: 15,
  keyPrefix: 'payment',
  message: 'Too many payment requests submitted. Please wait before retrying.',
});

const aiLimiter = createRateLimiter({
  windowSeconds: 60,
  maxRequests: 20,
  keyPrefix: 'ai',
  message: 'AI Assistant query limit reached. Please wait 1 minute before asking more questions.',
});

const generalLimiter = createRateLimiter({
  windowSeconds: 60,
  maxRequests: 120,
  keyPrefix: 'general',
});

module.exports = {
  createRateLimiter,
  authLimiter,
  bookingLimiter,
  paymentLimiter,
  aiLimiter,
  generalLimiter,
};

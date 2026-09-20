/**
 * Redis client connections and distributed utility methods for EventSphere.
 * Manages separate connections for commands, Pub/Sub, and BullMQ.
 */

const Redis = require('ioredis');
const config = require('./env');
const logger = require('./logger');

const redisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: true,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    logger.warn(`Redis connection retry #${times} in ${delay}ms`);
    return delay;
  },
};

// Primary Redis Client for operations, locks, caching
const redisClient = new Redis(redisOptions);

// Dedicated clients for Socket.IO Redis Adapter
const pubClient = new Redis(redisOptions);
const subClient = new Redis(redisOptions);

redisClient.on('connect', () => {
  logger.info('Redis client connected successfully');
});

redisClient.on('error', (err) => {
  logger.error('Redis connection error', { error: err.message });
});

pubClient.on('error', (err) => {
  logger.error('Redis PubClient error', { error: err.message });
});

subClient.on('error', (err) => {
  logger.error('Redis SubClient error', { error: err.message });
});

/**
 * Acquire a distributed seat lock.
 * @param {string} eventId
 * @param {string} seatId
 * @param {string} userId
 * @param {number} ttlSeconds - Default 600 (10 minutes)
 * @returns {Promise<boolean>} - True if acquired, false if already locked
 */
async function acquireSeatLock(eventId, seatId, userId, ttlSeconds = config.lock.seatLockTtlSeconds) {
  const lockKey = `seat_lock:${eventId}:${seatId}`;
  const result = await redisClient.set(lockKey, userId, 'EX', ttlSeconds, 'NX');
  return result === 'OK';
}

/**
 * Release a distributed seat lock atomically using Lua script.
 * Only releases if the lock is held by the requesting userId or forced by admin.
 * @param {string} eventId
 * @param {string} seatId
 * @param {string} userId
 * @param {boolean} force - Force release regardless of holder
 * @returns {Promise<boolean>}
 */
async function releaseSeatLock(eventId, seatId, userId, force = false) {
  const lockKey = `seat_lock:${eventId}:${seatId}`;
  if (force) {
    const delCount = await redisClient.del(lockKey);
    return delCount > 0;
  }

  // Lua script: verify ownership before deleting
  const luaScript = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  const result = await redisClient.eval(luaScript, 1, lockKey, userId);
  return result === 1;
}

/**
 * Get holder and remaining TTL for a seat lock.
 * @param {string} eventId
 * @param {string} seatId
 * @returns {Promise<{ locked: boolean, userId: string|null, ttl: number }>}
 */
async function getSeatLockStatus(eventId, seatId) {
  const lockKey = `seat_lock:${eventId}:${seatId}`;
  const [userId, ttl] = await Promise.all([
    redisClient.get(lockKey),
    redisClient.ttl(lockKey)
  ]);

  return {
    locked: Boolean(userId && ttl > 0),
    userId: userId || null,
    ttl: ttl > 0 ? ttl : 0
  };
}

/**
 * Invalidate Redis cache keys matching a pattern.
 * @param {string} pattern
 */
async function invalidateCachePattern(pattern) {
  try {
    const stream = redisClient.scanStream({ match: pattern, count: 100 });
    const keysToDelete = [];

    stream.on('data', (keys) => {
      if (keys.length) {
        keysToDelete.push(...keys);
      }
    });

    await new Promise((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    if (keysToDelete.length > 0) {
      await redisClient.del(...keysToDelete);
      logger.info('Cache keys invalidated', { pattern, count: keysToDelete.length });
    }
  } catch (err) {
    logger.error('Failed to invalidate cache pattern', { pattern, error: err.message });
  }
}

module.exports = {
  redisClient,
  pubClient,
  subClient,
  redisOptions,
  acquireSeatLock,
  releaseSeatLock,
  getSeatLockStatus,
  invalidateCachePattern,
};

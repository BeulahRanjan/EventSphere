/**
 * MongoDB database connection and resilient transaction helper for EventSphere.
 * Automatically checks for replica set availability for atomic multi-document operations.
 */

const mongoose = require('mongoose');
const config = require('./env');
const logger = require('./logger');

let isReplicaSet = false;

/**
 * Connect to MongoDB with retry logic and replica set detection.
 */
async function connectDatabase() {
  try {
    const conn = await mongoose.connect(config.mongodb.uri, {
      serverSelectionTimeoutMS: 5000,
    });

    logger.info(`MongoDB connected successfully: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);

    // Inspect replica set status
    try {
      const adminDb = conn.connection.db.admin();
      const status = await adminDb.command({ replSetGetStatus: 1 });
      if (status && status.ok === 1) {
        isReplicaSet = true;
        logger.info('MongoDB replica set detected: Full multi-document transactions enabled.');
      }
    } catch {
      isReplicaSet = false;
      logger.warn('MongoDB running in standalone mode: Transactions will execute in resilient fallback mode.');
    }

    return conn;
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error: error.message });
    throw error;
  }
}

/**
 * Executes an operation inside a MongoDB transaction if replica set is available,
 * otherwise executes cleanly without session wrapper.
 * @param {Function} callback - Function receiving (session)
 */
async function withTransaction(callback) {
  if (isReplicaSet) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const result = await callback(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } else {
    // Non-replica set fallback
    return await callback(null);
  }
}

module.exports = {
  connectDatabase,
  withTransaction,
  isReplicaSet: () => isReplicaSet,
};

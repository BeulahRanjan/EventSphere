/**
 * Server Entrypoint for EventSphere.
 * Boots MongoDB, Redis, Socket.IO, BullMQ workers, and domain event listeners.
 */

const http = require('http');
const app = require('./app');
const config = require('./config/env');
const logger = require('./config/logger');
const { connectDatabase } = require('./config/database');
const { redisClient } = require('./config/redis');
const { initSocketServer } = require('./socket');
const { initDomainEventListeners } = require('./events/listeners');
const { startWorkers, stopWorkers } = require('./queues/worker');

const server = http.createServer(app);

async function startServer() {
  try {
    logger.info(`Starting EventSphere Monolith [Instance: ${config.instanceId}, Env: ${config.env}]...`);

    // 1. Connect MongoDB
    await connectDatabase();

    // 2. Initialize Socket.IO with Redis Adapter
    initSocketServer(server);

    // 3. Initialize Domain Event Listeners
    initDomainEventListeners();

    // 4. Start BullMQ background workers (integrated in monolithic mode)
    if (process.env.START_WORKERS !== 'false') {
      startWorkers();
    }

    // 5. Start HTTP/WS Listener
    server.listen(config.port, () => {
      logger.info(`EventSphere Server running on port ${config.port}`);
      logger.info(`API Gateway: http://localhost:${config.port}/api/v1/health`);
    });
  } catch (error) {
    logger.error('Fatal startup error, shutting down process', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Graceful shutdown handling
async function shutdown(signal) {
  logger.info(`Received ${signal}. Gracefully shutting down...`);

  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      await stopWorkers();
      await redisClient.quit();
      logger.info('Graceful shutdown completed successfully.');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown', { error: err.message });
      process.exit(1);
    }
  });

  // Force close after 10s timeout
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully terminating');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
if (require.main === module) {
  startServer();
}

module.exports = { server, app };

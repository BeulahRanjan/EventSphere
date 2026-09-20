/**
 * Scalable Socket.IO Server Architecture with Redis Pub/Sub Adapter for EventSphere.
 * Enables synchronized real-time seat locking, live notifications, and room broadcasting across clustered Node instances.
 */

const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { pubClient, subClient } = require('../config/redis');
const { verifyAccessToken } = require('../utils/tokenHelper');
const logger = require('../config/logger');
const config = require('../config/env');

let io = null;

/**
 * Initialize Socket.IO with Redis cluster adapter.
 * @param {import('http').Server} httpServer
 */
function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: config.security.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    adapter: createAdapter(pubClient, subClient),
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  // Authentication Middleware for WebSocket Connections
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
        socket.handshake.query?.token;

      if (token) {
        try {
          const decoded = verifyAccessToken(token);
          socket.userId = decoded.id;
          socket.userRole = decoded.role;
        } catch {
          logger.debug('Socket connected with expired/unrecognized token; continuing as guest');
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  });

  io.on('connection', (socket) => {
    logger.debug(`Socket connected: ${socket.id} (user: ${socket.userId || 'guest'})`);

    // Auto-join personal user notification room if authenticated
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
      logger.debug(`Socket ${socket.id} joined user room: user:${socket.userId}`);
    }

    // Join specific event room for real-time seat selection updates
    socket.on('join:event', (eventId) => {
      if (eventId) {
        socket.join(`event:${eventId}`);
        logger.debug(`Socket ${socket.id} joined room event:${eventId}`);
      }
    });

    // Leave event room
    socket.on('leave:event', (eventId) => {
      if (eventId) {
        socket.leave(`event:${eventId}`);
        logger.debug(`Socket ${socket.id} left room event:${eventId}`);
      }
    });

    socket.on('disconnect', (reason) => {
      logger.debug(`Socket disconnected: ${socket.id} reason: ${reason}`);
    });
  });

  logger.info('Socket.IO initialized with Redis Adapter');
  return io;
}

/**
 * Returns the active Socket.IO server instance.
 */
function getIO() {
  return io;
}

/**
 * Broadcast real-time seat lock to event room.
 */
function broadcastSeatLock(eventId, seatId, userId, lockExpiresAt) {
  if (io) {
    io.to(`event:${eventId}`).emit('seat:locked', {
      eventId,
      seatId,
      lockedBy: userId,
      lockExpiresAt,
    });
  }
}

/**
 * Broadcast real-time seat unlock to event room.
 */
function broadcastSeatUnlock(eventId, seatId) {
  if (io) {
    io.to(`event:${eventId}`).emit('seat:unlocked', {
      eventId,
      seatId,
    });
  }
}

/**
 * Broadcast seat booked to event room.
 */
function broadcastSeatBooked(eventId, seatIds) {
  if (io) {
    io.to(`event:${eventId}`).emit('seat:booked', {
      eventId,
      seatIds,
    });
  }
}

/**
 * Send real-time notification to specific user room.
 */
function sendUserNotification(userId, notification) {
  if (io) {
    io.to(`user:${userId}`).emit('notification:new', notification);
  }
}

/**
 * Broadcast event updates (announcements, cancellations) to all connected clients.
 */
function broadcastEventUpdate(eventId, data) {
  if (io) {
    io.to(`event:${eventId}`).emit('event:updated', data);
    io.emit('event:feed_refresh', { eventId });
  }
}

module.exports = {
  initSocketServer,
  getIO,
  broadcastSeatLock,
  broadcastSeatUnlock,
  broadcastSeatBooked,
  sendUserNotification,
  broadcastEventUpdate,
};

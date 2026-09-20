/**
 * BullMQ Worker Processes for EventSphere.
 * Consumes background jobs: notification persistence, real-time push, email simulation,
 * delayed reminders, and expired seat lock cleanups.
 */

const { Worker } = require('bullmq');
const { redisOptions } = require('../config/redis');
const { notificationRepository, userRepository, seatRepository, bookingRepository } = require('../repositories');
const { sendUserNotification } = require('../socket');
const logger = require('../config/logger');

let workers = [];

function startWorkers() {
  logger.info('Initializing BullMQ workers...');

  // 1. Notification Worker
  const notificationWorker = new Worker(
    'notification-queue',
    async (job) => {
      const { userId, type, title, message, data } = job.data;
      logger.info(`[NotificationWorker] Processing notification for user ${userId}`, { type, title });

      // Check user preferences
      const preferences = await userRepository.getNotificationPreferences(userId);
      if (preferences && preferences.enabledTypes && !preferences.enabledTypes.includes(type)) {
        logger.info(`User ${userId} disabled notifications for type ${type}; skipping.`);
        return;
      }

      // Persist notification in MongoDB
      const notification = await notificationRepository.create({
        user: userId,
        type,
        title,
        message,
        data,
      });

      // Push real-time over Socket.IO to user room
      sendUserNotification(userId, notification);

      // Push updated unread counter
      const unreadCount = await notificationRepository.getUnreadCount(userId);
      sendUserNotification(userId, { type: 'UNREAD_COUNT', count: unreadCount });

      return { notificationId: notification._id };
    },
    { connection: redisOptions, concurrency: 5 }
  );

  // 2. Email Worker
  const emailWorker = new Worker(
    'email-queue',
    async (job) => {
      const { to, subject } = job.data;
      logger.info(`[EmailWorker] Sending email to ${to}: "${subject}"`);
      // Simulated email dispatch (can be connected to nodemailer / sendgrid)
      return { sent: true, to, timestamp: new Date() };
    },
    { connection: redisOptions, concurrency: 5 }
  );

  // 3. Reminder Worker
  const reminderWorker = new Worker(
    'reminder-queue',
    async (job) => {
      const { userId, eventTitle, reminderType, venueName, startDate } = job.data;
      logger.info(`[ReminderWorker] Firing ${reminderType} reminder for ${eventTitle} to user ${userId}`);

      const title = reminderType === '24h'
        ? `Reminder: ${eventTitle} is tomorrow!`
        : `Final Call: ${eventTitle} starts in 1 hour!`;

      const message = `Get ready! Your event at ${venueName} starts at ${new Date(startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Keep your QR tickets ready.`;

      // Persist & deliver reminder notification
      const notification = await notificationRepository.create({
        user: userId,
        type: 'EVENT_REMINDER',
        title,
        message,
        data: job.data,
      });

      sendUserNotification(userId, notification);
      return { reminded: true };
    },
    { connection: redisOptions, concurrency: 5 }
  );

  // 4. Cleanup Worker
  const cleanupWorker = new Worker(
    'cleanup-queue',
    async () => {
      logger.info('[CleanupWorker] Running periodic cleanup of expired reservations and locks');
      // Release expired seat locks in Mongo
      const seatResult = await seatRepository.releaseExpiredLocks();

      // Expire reserved bookings
      const expiredBookings = await bookingRepository.findExpiredReservations();
      for (const booking of expiredBookings) {
        await bookingRepository.updateStatus(booking._id, 'EXPIRED');
        // Release seats back to available
        await seatRepository.markSeatsAvailable(booking.seats);
      }

      return {
        releasedSeats: seatResult.modifiedCount,
        expiredBookings: expiredBookings.length,
      };
    },
    { connection: redisOptions, concurrency: 1 }
  );

  // Error monitoring
  [notificationWorker, emailWorker, reminderWorker, cleanupWorker].forEach((worker) => {
    worker.on('failed', (job, err) => {
      logger.error(`Worker job ${job.id} failed in queue ${worker.name}`, { error: err.message });
    });
  });

  workers = [notificationWorker, emailWorker, reminderWorker, cleanupWorker];
  logger.info('All 4 BullMQ workers actively listening for jobs');
}

async function stopWorkers() {
  await Promise.all(workers.map((w) => w.close()));
  logger.info('BullMQ workers stopped');
}

// Standalone execution support
if (require.main === module) {
  const { connectDatabase } = require('../config/database');
  connectDatabase().then(() => {
    startWorkers();
  });
}

module.exports = {
  startWorkers,
  stopWorkers,
};

/**
 * BullMQ Queues setup for EventSphere.
 * Manages background asynchronous workloads, notification delivery, and delayed reminder jobs.
 */

const { Queue } = require('bullmq');
const { redisOptions } = require('../config/redis');
const logger = require('../config/logger');

// Queue instance definitions
const notificationQueue = new Queue('notification-queue', { connection: redisOptions });
const emailQueue = new Queue('email-queue', { connection: redisOptions });
const reminderQueue = new Queue('reminder-queue', { connection: redisOptions });
const cleanupQueue = new Queue('cleanup-queue', { connection: redisOptions });

/**
 * Enqueue a notification delivery job.
 * @param {object} payload - { userId, type, title, message, data }
 */
async function addNotificationJob(payload) {
  try {
    return await notificationQueue.add('send-notification', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  } catch (error) {
    logger.error('Failed to enqueue notification job', { error: error.message });
  }
}

/**
 * Enqueue an asynchronous email delivery job.
 * @param {object} payload - { to, subject, html, template }
 */
async function addEmailJob(payload) {
  try {
    return await emailQueue.add('send-email', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 50,
    });
  } catch (error) {
    logger.error('Failed to enqueue email job', { error: error.message });
  }
}

/**
 * Schedule automated event reminders (24h and 1h prior to start).
 * @param {object} event - Event document
 * @param {object} booking - Booking document
 * @param {object} user - User document
 */
async function scheduleEventReminders(event, booking, user) {
  try {
    const eventTime = new Date(event.startDate).getTime();
    const now = Date.now();

    // 24 hours prior
    const delay24h = eventTime - 24 * 60 * 60 * 1000 - now;
    if (delay24h > 0) {
      await reminderQueue.add(
        'event-reminder-24h',
        {
          userId: user._id,
          eventId: event._id,
          eventTitle: event.title,
          reminderType: '24h',
          venueName: event.venue ? event.venue.name : 'Event Venue',
          startDate: event.startDate,
        },
        { delay: delay24h, jobId: `reminder-24h:${booking._id}` }
      );
      logger.info(`Scheduled 24h reminder for event ${event.title} in ${Math.round(delay24h / 1000)}s`);
    }

    // 1 hour prior
    const delay1h = eventTime - 60 * 60 * 1000 - now;
    if (delay1h > 0) {
      await reminderQueue.add(
        'event-reminder-1h',
        {
          userId: user._id,
          eventId: event._id,
          eventTitle: event.title,
          reminderType: '1h',
          venueName: event.venue ? event.venue.name : 'Event Venue',
          startDate: event.startDate,
        },
        { delay: delay1h, jobId: `reminder-1h:${booking._id}` }
      );
      logger.info(`Scheduled 1h reminder for event ${event.title} in ${Math.round(delay1h / 1000)}s`);
    }
  } catch (error) {
    logger.error('Failed to schedule event reminders', { error: error.message });
  }
}

module.exports = {
  notificationQueue,
  emailQueue,
  reminderQueue,
  cleanupQueue,
  addNotificationJob,
  addEmailJob,
  scheduleEventReminders,
};

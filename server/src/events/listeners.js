/**
 * Domain Event Listeners for EventSphere.
 * Decouples core services from background jobs, cache invalidation, and notifications.
 */

const domainEventEmitter = require('./eventEmitter');
const DOMAIN_EVENTS = require('./domainEvents');
const { addNotificationJob, addEmailJob, scheduleEventReminders } = require('../queues');
const { invalidateCachePattern } = require('../config/redis');
const { broadcastEventUpdate } = require('../socket');
const { userRepository, bookingRepository } = require('../repositories');
const logger = require('../config/logger');

function initDomainEventListeners() {
  // Listener: Event Published
  domainEventEmitter.on(DOMAIN_EVENTS.EVENT_PUBLISHED, async (event) => {
    try {
      logger.info(`Handling ${DOMAIN_EVENTS.EVENT_PUBLISHED} for event ${event.title}`, { eventId: event._id });

      // Invalidate event cache keys
      await Promise.all([
        invalidateCachePattern('events:*'),
        invalidateCachePattern(`event:${event._id}`),
      ]);

      // Broadcast real-time feed refresh
      broadcastEventUpdate(event._id, { type: 'EVENT_PUBLISHED', event });

      // Find users who have preferences matching event city or category
      const city = event.venue && event.venue.city ? event.venue.city : null;
      const categoryId = event.category?._id || event.category;

      const relevantUsers = await userRepository.findUsersByLocationsOrCategories(
        city ? [city] : [],
        categoryId ? [categoryId] : []
      );

      for (const user of relevantUsers) {
        await addNotificationJob({
          userId: user._id,
          type: 'NEW_LOCAL_EVENT',
          title: `New Event in ${city || 'Your Area'}: ${event.title}`,
          message: `Tickets are now live for ${event.title}. Book your seats before they sell out!`,
          data: { eventId: event._id, slug: event.slug },
        });
      }
    } catch (error) {
      logger.error(`Error in ${DOMAIN_EVENTS.EVENT_PUBLISHED} listener`, { error: error.message });
    }
  });

  // Listener: Event Updated
  domainEventEmitter.on(DOMAIN_EVENTS.EVENT_UPDATED, async (event) => {
    try {
      logger.info(`Handling ${DOMAIN_EVENTS.EVENT_UPDATED} for event ${event.title}`, { eventId: event._id });
      await Promise.all([
        invalidateCachePattern('events:*'),
        invalidateCachePattern(`event:${event._id}`),
      ]);
      broadcastEventUpdate(event._id, { type: 'EVENT_UPDATED', event });
    } catch (error) {
      logger.error(`Error in ${DOMAIN_EVENTS.EVENT_UPDATED} listener`, { error: error.message });
    }
  });

  // Listener: Event Cancelled
  domainEventEmitter.on(DOMAIN_EVENTS.EVENT_CANCELLED, async (event) => {
    try {
      logger.info(`Handling ${DOMAIN_EVENTS.EVENT_CANCELLED} for event ${event.title}`, { eventId: event._id });
      await Promise.all([
        invalidateCachePattern('events:*'),
        invalidateCachePattern(`event:${event._id}`),
      ]);
      broadcastEventUpdate(event._id, { type: 'EVENT_CANCELLED', event });

      // Find all bookings for this event and notify users
      const bookings = await bookingRepository.find({ event: event._id, status: 'CONFIRMED' });
      for (const booking of bookings) {
        await addNotificationJob({
          userId: booking.user,
          type: 'EVENT_CANCELLED',
          title: `Event Cancelled: ${event.title}`,
          message: `We regret to inform you that ${event.title} has been cancelled. Your refund has been initiated.`,
          data: { eventId: event._id, bookingId: booking._id },
        });
      }
    } catch (error) {
      logger.error(`Error in ${DOMAIN_EVENTS.EVENT_CANCELLED} listener`, { error: error.message });
    }
  });

  // Listener: Booking Confirmed
  domainEventEmitter.on(DOMAIN_EVENTS.BOOKING_CONFIRMED, async ({ booking, event, user, tickets }) => {
    try {
      logger.info(`Handling ${DOMAIN_EVENTS.BOOKING_CONFIRMED} for booking ${booking.bookingNumber}`);

      // Enqueue notification for the booking user
      await addNotificationJob({
        userId: user._id,
        type: 'BOOKING_CONFIRMED',
        title: 'Booking Confirmed!',
        message: `Your booking #${booking.bookingNumber} for ${event.title} is confirmed. ${tickets.length} ticket(s) issued.`,
        data: {
          bookingId: booking._id,
          bookingNumber: booking.bookingNumber,
          eventId: event._id,
          ticketCount: tickets.length,
        },
      });

      // Enqueue confirmation email
      await addEmailJob({
        to: user.email,
        subject: `Booking Confirmed: ${event.title} (#${booking.bookingNumber})`,
        template: 'booking-confirmation',
        data: {
          userName: user.name,
          bookingNumber: booking.bookingNumber,
          eventTitle: event.title,
          finalAmount: booking.finalAmount,
        },
      });

      // Schedule automated 24h and 1h event reminders
      await scheduleEventReminders(event, booking, user);

      // Invalidate event detail cache to reflect new available seat counts
      await invalidateCachePattern(`event:${event._id}`);
      await invalidateCachePattern('events:popular');
    } catch (error) {
      logger.error(`Error in ${DOMAIN_EVENTS.BOOKING_CONFIRMED} listener`, { error: error.message });
    }
  });

  // Listener: Booking Cancelled
  domainEventEmitter.on(DOMAIN_EVENTS.BOOKING_CANCELLED, async ({ booking, event, user }) => {
    try {
      await addNotificationJob({
        userId: user._id,
        type: 'BOOKING_CANCELLED',
        title: 'Booking Cancelled',
        message: `Your booking #${booking.bookingNumber} for ${event.title} has been cancelled.`,
        data: { bookingId: booking._id },
      });
      await invalidateCachePattern(`event:${event._id}`);
    } catch (error) {
      logger.error(`Error in ${DOMAIN_EVENTS.BOOKING_CANCELLED} listener`, { error: error.message });
    }
  });

  // Listener: Payment Failed
  domainEventEmitter.on(DOMAIN_EVENTS.PAYMENT_FAILED, async ({ payment, user, reason }) => {
    try {
      await addNotificationJob({
        userId: user._id,
        type: 'PAYMENT_FAILED',
        title: 'Payment Failed',
        message: `Your payment of ₹${payment.amount} could not be processed. ${reason || 'Please try another method.'}`,
        data: { paymentId: payment._id, bookingId: payment.booking },
      });
    } catch (error) {
      logger.error(`Error in ${DOMAIN_EVENTS.PAYMENT_FAILED} listener`, { error: error.message });
    }
  });

  logger.info('Domain event listeners initialized');
}

module.exports = {
  initDomainEventListeners,
};

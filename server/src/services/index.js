/**
 * Central Service Exports for EventSphere.
 */

const authService = require('./AuthService');
const eventService = require('./EventService');
const seatService = require('./SeatService');
const bookingService = require('./BookingService');
const paymentService = require('./PaymentService');
const ticketService = require('./TicketService');
const notificationService = require('./NotificationService');
const recommendationService = require('./RecommendationService');
const externalEventService = require('./ExternalEventService');
const aiAssistantService = require('./AiAssistantService');

module.exports = {
  authService,
  eventService,
  seatService,
  bookingService,
  paymentService,
  ticketService,
  notificationService,
  recommendationService,
  externalEventService,
  aiAssistantService,
};

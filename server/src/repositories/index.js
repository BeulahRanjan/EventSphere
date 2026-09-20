/**
 * Central Repositories Export for EventSphere.
 */

const userRepository = require('./UserRepository');
const categoryRepository = require('./CategoryRepository');
const venueRepository = require('./VenueRepository');
const seatRepository = require('./SeatRepository');
const eventRepository = require('./EventRepository');
const bookingRepository = require('./BookingRepository');
const paymentRepository = require('./PaymentRepository');
const ticketRepository = require('./TicketRepository');
const notificationRepository = require('./NotificationRepository');

module.exports = {
  userRepository,
  categoryRepository,
  venueRepository,
  seatRepository,
  eventRepository,
  bookingRepository,
  paymentRepository,
  ticketRepository,
  notificationRepository,
};

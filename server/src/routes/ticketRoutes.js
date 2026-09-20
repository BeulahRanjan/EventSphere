/**
 * Ticket Routes for EventSphere.
 */

const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/TicketController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/rbacMiddleware');
const validate = require('../middleware/validatorHandler');
const { verifyTicketValidator } = require('../validators/seatValidators');

// User ticket history
router.get('/', authMiddleware, ticketController.getUserTickets);

// Single ticket view
router.get('/:id', authMiddleware, ticketController.getTicket);

// Venue gate scan verification endpoint
router.post(
  '/verify',
  authMiddleware,
  authorizeRoles('EVENT_ORGANIZER', 'ADMIN'),
  verifyTicketValidator,
  validate,
  ticketController.verifyTicket
);

module.exports = router;

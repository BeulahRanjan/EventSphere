/**
 * AiController for EventSphere.
 * Manages specialized natural language queries for events, tickets, and bookings.
 */

const { aiAssistantService } = require('../services');
const { sendSuccess } = require('../utils/response');

class AiController {
  async queryAssistant(req, res, next) {
    try {
      const userId = req.user ? req.user._id : 'guest';
      const { message, conversationId } = req.body;

      const result = await aiAssistantService.processQuery(userId, message, conversationId);
      return sendSuccess(res, 'AI Assistant response generated', result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AiController();

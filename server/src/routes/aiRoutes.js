/**
 * AI Assistant Routes for EventSphere.
 */

const express = require('express');
const router = express.Router();
const aiController = require('../controllers/AiController');
const { optionalAuthMiddleware } = require('../middleware/authMiddleware');
const { aiLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validatorHandler');
const { queryAiValidator } = require('../validators/aiValidators');

router.post(
  '/chat',
  optionalAuthMiddleware,
  aiLimiter,
  queryAiValidator,
  validate,
  aiController.queryAssistant
);

module.exports = router;

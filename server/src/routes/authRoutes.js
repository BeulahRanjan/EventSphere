/**
 * Auth Routes for EventSphere.
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/AuthController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validatorHandler');
const {
  registerValidator,
  loginValidator,
  refreshTokenValidator,
  updateProfileValidator,
} = require('../validators/authValidators');

router.post('/register', authLimiter, registerValidator, validate, authController.register);
router.post('/login', authLimiter, loginValidator, validate, authController.login);
router.post('/refresh', refreshTokenValidator, validate, authController.refreshTokens);
router.post('/logout', authMiddleware, authController.logout);
router.get('/me', authMiddleware, authController.getProfile);
router.put('/me', authMiddleware, updateProfileValidator, validate, authController.updateProfile);
router.get('/preferences', authMiddleware, authController.getPreferences);
router.put('/preferences', authMiddleware, authController.updatePreferences);

module.exports = router;

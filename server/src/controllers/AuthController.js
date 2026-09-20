/**
 * AuthController for EventSphere.
 * Thin controller dispatching auth requests to AuthService.
 */

const { authService } = require('../services');
const { sendSuccess } = require('../utils/response');

class AuthController {
  async register(req, res, next) {
    try {
      const result = await authService.register(req.body);
      return sendSuccess(res, 'User registered successfully', result, 201);
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);

      // Set refresh token in secure HTTP-only cookie if desired
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return sendSuccess(res, 'Login successful', result);
    } catch (error) {
      next(error);
    }
  }

  async refreshTokens(req, res, next) {
    try {
      const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
      const tokens = await authService.refreshTokens(refreshToken);
      return sendSuccess(res, 'Tokens refreshed successfully', tokens);
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      await authService.logout(req.user._id);
      res.clearCookie('refreshToken');
      return sendSuccess(res, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req, res, next) {
    try {
      const profile = await authService.getProfile(req.user._id);
      return sendSuccess(res, 'Profile retrieved', profile);
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const updated = await authService.updateProfile(req.user._id, req.body);
      return sendSuccess(res, 'Profile updated successfully', updated);
    } catch (error) {
      next(error);
    }
  }

  async getPreferences(req, res, next) {
    try {
      const prefs = await authService.getNotificationPreferences(req.user._id);
      return sendSuccess(res, 'Notification preferences retrieved', prefs);
    } catch (error) {
      next(error);
    }
  }

  async updatePreferences(req, res, next) {
    try {
      const updated = await authService.updateNotificationPreferences(req.user._id, req.body);
      return sendSuccess(res, 'Notification preferences updated', updated);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();

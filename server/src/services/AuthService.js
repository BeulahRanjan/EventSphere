/**
 * AuthService for EventSphere.
 * Manages user registration, credential authentication, refresh token rotation, and RBAC profiles.
 */

const { userRepository } = require('../repositories');
const { generateTokens, verifyRefreshToken } = require('../utils/tokenHelper');
const { AuthError, ConflictError, NotFoundError } = require('../errors');
const logger = require('../config/logger');

class AuthService {
  /**
   * Register a new user account.
   * @param {object} payload - { name, email, password, role, phone, preferredLocations, preferredCategories }
   */
  async register(payload) {
    const existing = await userRepository.findByEmail(payload.email);
    if (existing) {
      throw new ConflictError('An account with this email address already exists.');
    }

    // Default role is USER unless specified and permitted
    const role = ['USER', 'EVENT_ORGANIZER'].includes(payload.role) ? payload.role : 'USER';

    const user = await userRepository.create({
      ...payload,
      role,
    });

    const tokens = generateTokens(user);
    await userRepository.updateRefreshToken(user._id, tokens.refreshToken);

    // Initialize notification preferences
    await userRepository.getNotificationPreferences(user._id);

    logger.info('User registered successfully', { userId: user._id, role: user.role });

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        preferredLocations: user.preferredLocations,
      },
      ...tokens,
    };
  }

  /**
   * Authenticate user credentials and return access + refresh tokens.
   * @param {string} email
   * @param {string} password
   */
  async login(email, password) {
    const user = await userRepository.findByEmailWithPassword(email);
    if (!user) {
      throw new AuthError('Invalid email or password.');
    }

    if (!user.isActive) {
      throw new AuthError('Account is inactive. Please contact support.');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AuthError('Invalid email or password.');
    }

    const tokens = generateTokens(user);
    await userRepository.updateRefreshToken(user._id, tokens.refreshToken);

    logger.info('User logged in successfully', { userId: user._id, role: user.role });

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        preferredLocations: user.preferredLocations,
      },
      ...tokens,
    };
  }

  /**
   * Rotate access and refresh tokens using an active refresh token.
   * @param {string} incomingRefreshToken
   */
  async refreshTokens(incomingRefreshToken) {
    if (!incomingRefreshToken) {
      throw new AuthError('Refresh token is required.');
    }

    const decoded = verifyRefreshToken(incomingRefreshToken);
    const user = await userRepository.findById(decoded.id, null, { select: '+refreshToken' });

    if (!user || !user.isActive) {
      throw new AuthError('User account not found or deactivated.');
    }

    // In a strict rotation model, verify stored token matches
    if (user.refreshToken !== incomingRefreshToken) {
      logger.warn('Refresh token reuse or mismatch detected', { userId: user._id });
      throw new AuthError('Invalid refresh token. Please log in again.');
    }

    const tokens = generateTokens(user);
    await userRepository.updateRefreshToken(user._id, tokens.refreshToken);

    return tokens;
  }

  /**
   * Invalidate active session and clear stored refresh token.
   * @param {string} userId
   */
  async logout(userId) {
    await userRepository.updateRefreshToken(userId, null);
    logger.info('User logged out', { userId });
    return true;
  }

  /**
   * Get user profile details.
   * @param {string} userId
   */
  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User profile not found.');
    }
    return user;
  }

  /**
   * Update user profile information and preferences.
   * @param {string} userId
   * @param {object} updateData
   */
  async updateProfile(userId, updateData) {
    // Prevent updating protected fields directly
    delete updateData.password;
    delete updateData.role;
    delete updateData.email;
    delete updateData.refreshToken;

    const user = await userRepository.updateById(userId, updateData);
    if (!user) {
      throw new NotFoundError('User not found.');
    }
    return user;
  }

  /**
   * Get notification preferences for a user.
   * @param {string} userId
   */
  async getNotificationPreferences(userId) {
    return userRepository.getNotificationPreferences(userId);
  }

  /**
   * Update notification preferences for a user.
   * @param {string} userId
   * @param {object} updateData
   */
  async updateNotificationPreferences(userId, updateData) {
    return userRepository.updateNotificationPreferences(userId, updateData);
  }
}

module.exports = new AuthService();

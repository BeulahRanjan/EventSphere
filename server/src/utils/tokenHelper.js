/**
 * JWT token generation and verification utility for EventSphere.
 */

const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { AuthError } = require('../errors');

/**
 * Generate Access and Refresh tokens for a user.
 * @param {object} user - User document or payload with _id, email, role
 * @returns {{ accessToken: string, refreshToken: string }}
 */
function generateTokens(user) {
  const payload = {
    id: user._id || user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  };

  const accessToken = jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
  });

  const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });

  return { accessToken, refreshToken };
}

/**
 * Verify an access token.
 * @param {string} token
 * @returns {object} decoded payload
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, config.jwt.accessSecret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AuthError('Access token has expired. Please refresh your session.');
    }
    throw new AuthError('Invalid access token.');
  }
}

/**
 * Verify a refresh token.
 * @param {string} token
 * @returns {object} decoded payload
 */
function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, config.jwt.refreshSecret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AuthError('Refresh token has expired. Please log in again.');
    }
    throw new AuthError('Invalid refresh token.');
  }
}

module.exports = {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
};

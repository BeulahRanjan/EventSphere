/**
 * Authentication Middleware for EventSphere.
 * Verifies JWT bearer tokens and hydrates req.user.
 */

const { verifyAccessToken } = require('../utils/tokenHelper');
const { userRepository } = require('../repositories');
const { AuthError } = require('../errors');

async function authMiddleware(req, res, next) {
  try {
    let token = null;

    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      throw new AuthError('Authentication required. No token provided.');
    }

    const decoded = verifyAccessToken(token);

    const user = await userRepository.findById(decoded.id);
    if (!user || !user.isActive) {
      throw new AuthError('User account not found or deactivated.');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication middleware: if token present, hydrates req.user; otherwise proceeds.
 */
async function optionalAuthMiddleware(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (token) {
      try {
        const decoded = verifyAccessToken(token);
        const user = await userRepository.findById(decoded.id);
        if (user && user.isActive) {
          req.user = user;
        }
      } catch {
        // Ignore invalid token in optional mode
      }
    }
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
};

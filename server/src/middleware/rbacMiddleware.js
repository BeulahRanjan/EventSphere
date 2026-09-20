/**
 * Role-Based Access Control (RBAC) Middleware for EventSphere.
 * Restricts route access based on user role ('USER', 'EVENT_ORGANIZER', 'ADMIN').
 */

const { ForbiddenError } = require('../errors');

/**
 * Higher-order middleware to enforce role requirements.
 * @param  {...string} allowedRoles - E.g. 'ADMIN', 'EVENT_ORGANIZER'
 */
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ForbiddenError('Access denied. Authentication required.'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access denied. Role '${req.user.role}' is not authorized to access this resource.`
        )
      );
    }

    next();
  };
}

module.exports = {
  authorizeRoles,
};

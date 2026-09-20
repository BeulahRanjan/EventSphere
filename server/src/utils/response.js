/**
 * Standard API response helper for EventSphere.
 * Formats success and error responses predictably across all controllers.
 */

/**
 * Send standard success response.
 * @param {object} res - Express response object
 * @param {string} message - Human-readable summary
 * @param {any} data - Response payload
 * @param {number} statusCode - HTTP status code (default 200)
 */
function sendSuccess(res, message = 'Operation successful', data = null, statusCode = 200) {
  const payload = {
    success: true,
    message,
  };
  if (data !== null && data !== undefined) {
    payload.data = data;
  }
  return res.status(statusCode).json(payload);
}

/**
 * Send standard error response.
 * @param {object} res - Express response object
 * @param {string} message - Human-readable error description
 * @param {any} errors - Validation errors or detailed error list
 * @param {number} statusCode - HTTP status code (default 500)
 */
function sendError(res, message = 'An error occurred', errors = null, statusCode = 500) {
  const payload = {
    success: false,
    message,
  };
  if (errors !== null && errors !== undefined) {
    payload.errors = errors;
  }
  return res.status(statusCode).json(payload);
}

module.exports = {
  sendSuccess,
  sendError,
};

/**
 * Cryptographic QR Code and Ticket Verification Generator for EventSphere.
 * Employs HMAC-SHA256 signatures to prevent ticket counterfeiting without leaking PII.
 */

const crypto = require('crypto');
const QRCode = require('qrcode');
const config = require('../config/env');

/**
 * Generates an HMAC verification token for a ticket.
 * @param {string} ticketNumber
 * @param {string} eventId
 * @param {string} userId
 * @returns {string} Hex HMAC token
 */
function generateVerificationToken(ticketNumber, eventId, userId) {
  const payload = `${ticketNumber}:${eventId}:${userId}:${Date.now()}`;
  return crypto
    .createHmac('sha256', config.security.ticketHmacSecret)
    .update(payload)
    .digest('hex');
}

/**
 * Generates a QR Code as a Data URL containing the verification endpoint link.
 * Does NOT embed sensitive personal details.
 * @param {string} verificationToken
 * @param {string} ticketNumber
 * @returns {Promise<string>} Base64 Data URL of QR code image
 */
async function generateQrCode(verificationToken, ticketNumber) {
  // Safe payload for QR scanner: verification URL + ticketNumber
  const payload = JSON.stringify({
    type: 'EVENTSPHERE_TICKET',
    ticketNumber,
    token: verificationToken,
  });

  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    margin: 2,
    color: {
      dark: '#22223B',   // Palette Primary
      light: '#FAFAFA',  // Palette Background
    },
  });
}

module.exports = {
  generateVerificationToken,
  generateQrCode,
};

/**
 * Mailer — intentionally a no-op for now.
 *
 * Email verification / OTP is explicitly out of scope for the auth foundation.
 * The module exists (and the service that wraps it) so that adding OTP later
 * is a change in one place rather than a new module.
 */

const env = require('./env');
const logger = require('../utils/logger');

const isEnabled = () => env.email.enabled;

/**
 * @param {{ to: string, subject: string, text?: string, html?: string }} message
 * @returns {Promise<{ delivered: boolean, reason?: string }>}
 */
async function sendMail(message) {
  if (!isEnabled()) {
    logger.warn(
      `Email disabled — skipped "${message.subject}" to ${message.to}. ` +
        'Set EMAIL_ENABLED=true and configure a transport to deliver it.'
    );
    return { delivered: false, reason: 'email_disabled' };
  }

  throw new Error('Email transport is not configured yet.');
}

module.exports = { isEnabled, sendMail };

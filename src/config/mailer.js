/**
 * Resend mail transport.
 *
 * Env:
 *   EMAIL_ENABLED=true
 *   RESEND_API_KEY=re_...
 *   EMAIL_FROM=FastNxt <no-reply@example.com>
 */

const { Resend } = require('resend');
const env = require('./env');
const logger = require('../utils/logger');

let client = null;

const isEnabled = () => Boolean(env.email.enabled && env.email.resendApiKey);

function getClient() {
  if (!client) {
    client = new Resend(env.email.resendApiKey);
  }
  return client;
}

/**
 * @param {{
 *   to: string | string[],
 *   subject: string,
 *   html?: string,
 *   text?: string,
 *   replyTo?: string,
 * }} message
 * @returns {Promise<{ delivered: boolean, id?: string, reason?: string, error?: string }>}
 */
async function sendMail(message) {
  if (!isEnabled()) {
    logger.warn(
      `Email disabled — skipped "${message.subject}" to ${message.to}. ` +
        'Set EMAIL_ENABLED=true and RESEND_API_KEY to deliver.'
    );
    return { delivered: false, reason: 'email_disabled' };
  }

  const to = Array.isArray(message.to) ? message.to : [message.to];
  try {
    const resend = getClient();
    const { data, error } = await resend.emails.send({
      from: env.email.from,
      to,
      subject: message.subject,
      html: message.html || undefined,
      text: message.text || undefined,
      reply_to: message.replyTo || env.email.replyTo || undefined,
    });

    if (error) {
      logger.error(`Resend error: ${error.message || JSON.stringify(error)}`);
      return { delivered: false, reason: 'provider_error', error: error.message || String(error) };
    }

    logger.info(`Email sent via Resend to ${to.join(', ')} — id=${data?.id || 'n/a'}`);
    return { delivered: true, id: data?.id || undefined };
  } catch (err) {
    logger.error(`Resend send failed: ${err.message}`);
    return { delivered: false, reason: 'send_failed', error: err.message };
  }
}

module.exports = { isEnabled, sendMail };

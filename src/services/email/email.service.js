/**
 * Email service — Resend delivery + MailLog ledger (per-school counts).
 */

const mailer = require('../../config/mailer');
const templates = require('./templates');
const { prisma } = require('../../config/database');
const env = require('../../config/env');
const logger = require('../../utils/logger');

/**
 * Persist a mail attempt for usage counting.
 */
async function logMail({
  schoolId = null,
  userId = null,
  toEmail,
  subject,
  template,
  brand = 'platform',
  status,
  providerId = null,
  error = null,
  meta = null,
}) {
  try {
    return await prisma.mailLog.create({
      data: {
        schoolId: schoolId || null,
        userId: userId || null,
        toEmail: String(toEmail).toLowerCase(),
        subject,
        template,
        brand,
        status,
        providerId,
        error,
        meta: meta || undefined,
      },
    });
  } catch (err) {
    logger.warn(`Failed to write mail log: ${err.message}`);
    return null;
  }
}

async function deliver({
  to,
  subject,
  html,
  text,
  schoolId = null,
  userId = null,
  template = 'generic',
  brand = 'platform',
  meta = null,
}) {
  const result = await mailer.sendMail({ to, subject, html, text });
  const status = result.delivered ? 'sent' : result.reason === 'email_disabled' ? 'skipped' : 'failed';
  await logMail({
    schoolId,
    userId,
    toEmail: Array.isArray(to) ? to[0] : to,
    subject,
    template,
    brand,
    status,
    providerId: result.id || null,
    error: result.error || (result.delivered ? null : result.reason) || null,
    meta,
  });
  return result;
}

/** Platform welcome email (BisonsTechs branding) after school registration. */
async function sendWelcomeEmail({ to, name, schoolName, schoolId, userId, trialDays }) {
  const days = trialDays || env.subscription.trialDays;
  const content = templates.welcomePlatform({ name, schoolName, trialDays: days });
  return deliver({
    to,
    subject: content.subject,
    html: content.html,
    text: content.text,
    schoolId,
    userId,
    template: 'welcome',
    brand: 'platform',
    meta: { schoolName },
  });
}

async function sendTrialExpiryWarning({ to, schoolName, daysLeft, schoolId, userId, schoolLogoUrl }) {
  const title = `Your trial ends in ${daysLeft} day(s)`;
  const content = templates.schoolNotice({
    schoolName,
    schoolLogoUrl,
    title,
    messageHtml: `<p style="margin:0 0 12px;">The free trial for <strong>${templates.escapeHtml(schoolName)}</strong> expires in <strong>${daysLeft}</strong> day(s). Upgrade to keep full access.</p>`,
    cta: { label: 'View plans', href: `${env.brand.appUrl}/subscription` },
  });
  return deliver({
    to,
    subject: content.subject,
    html: content.html,
    text: content.text,
    schoolId,
    userId,
    template: 'trial_warning',
    brand: schoolLogoUrl ? 'school' : 'platform',
  });
}

/**
 * School-branded email helper for future modules (notices, fees, etc.).
 * Always uses the school's logo when present.
 */
async function sendSchoolEmail({
  to,
  school,
  title,
  messageHtml,
  cta,
  userId = null,
  template = 'school_notice',
}) {
  const content = templates.schoolNotice({
    schoolName: school?.name || 'School',
    schoolLogoUrl: school?.logoUrl || null,
    title,
    messageHtml,
    cta,
  });
  return deliver({
    to,
    subject: content.subject,
    html: content.html,
    text: content.text,
    schoolId: school?.id || null,
    userId,
    template,
    brand: 'school',
  });
}

module.exports = {
  sendWelcomeEmail,
  sendTrialExpiryWarning,
  sendSchoolEmail,
  deliver,
  logMail,
};

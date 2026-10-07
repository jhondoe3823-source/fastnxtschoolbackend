/**
 * Email service.
 *
 * Out of scope for the auth foundation (no verification / OTP / password
 * reset yet). The functions exist so that when those features land the
 * controller code is a one-line call rather than a new module.
 */

const mailer = require('../../config/mailer');

async function sendWelcomeEmail({ to, name, schoolName }) {
  return mailer.sendMail({
    to,
    subject: `Welcome to BisonsEduCore360, ${name}`,
    text: `Your school "${schoolName}" has been registered. Your free trial has started.`,
  });
}

async function sendTrialExpiryWarning({ to, schoolName, daysLeft }) {
  return mailer.sendMail({
    to,
    subject: `Your BisonsEduCore360 trial ends in ${daysLeft} day(s)`,
    text: `The free trial for "${schoolName}" expires in ${daysLeft} day(s).`,
  });
}

module.exports = { sendWelcomeEmail, sendTrialExpiryWarning };

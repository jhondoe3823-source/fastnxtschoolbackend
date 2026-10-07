/**
 * Cloudinary — configuration holder only.
 *
 * File uploads are outside the auth/subscription scope, so nothing is wired to
 * the SDK. Credentials are read here so the upload service has a single place
 * to look once it is implemented.
 */

const env = require('./env');

const isConfigured = () =>
  Boolean(
    env.cloudinary.enabled &&
      env.cloudinary.cloudName &&
      env.cloudinary.apiKey &&
      env.cloudinary.apiSecret
  );

module.exports = {
  isConfigured,
  cloudName: env.cloudinary.cloudName,
  apiKey: env.cloudinary.apiKey,
  apiSecret: env.cloudinary.apiSecret,
  folder: 'bisonseducore360',
};

/**
 * Cloudinary SDK bootstrap.
 *
 * Credentials come from env only — never hardcode secrets in source.
 */

const { v2: cloudinary } = require('cloudinary');
const env = require('./env');

const isConfigured = () =>
  Boolean(
    env.cloudinary.enabled &&
      env.cloudinary.cloudName &&
      env.cloudinary.apiKey &&
      env.cloudinary.apiSecret
  );

if (isConfigured()) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true,
  });
}

module.exports = {
  cloudinary,
  isConfigured,
  cloudName: env.cloudinary.cloudName,
  apiKey: env.cloudinary.apiKey,
  folder: env.cloudinary.folder || 'bisonseducore360',
};

/**
 * Environment loader + validation.
 *
 * This module is required first (from app.js/server.js) and is idempotent:
 * dotenv only reads the file once. Everything else in the codebase reads
 * settings through `require('../config/env')` rather than `process.env`, so
 * defaults and validation live in exactly one place.
 */

const path = require('path');

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

// Standard dotenv behaviour: real environment variables win over `.env`, which
// keeps `PORT=... node src/server.js` overrides (and platform vars in
// production) authoritative. `quiet` silences the dotenv banner.
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env'),
  quiet: true,
});

/** Read a string env var with a default. */
const str = (name, fallback = '') => {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : String(value).trim();
};

/** Read a numeric env var with a default, ignoring garbage. */
const num = (name, fallback) => {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/** Read a boolean env var ("true"/"1"/"yes"). */
const bool = (name, fallback = false) => {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const JWT_SECRET = str('JWT_SECRET', 'dev-only-insecure-secret');

// Fail fast rather than silently signing tokens with a public default value.
if (isProduction && (JWT_SECRET === 'dev-only-insecure-secret' || JWT_SECRET.length < 32)) {
  throw new Error(
    'JWT_SECRET must be set to a long random value in production.'
  );
}

const env = {
  nodeEnv: NODE_ENV,
  isProduction,
  port: num('PORT', 5000),
  host: str('HOST', '0.0.0.0'),

  /** Allowed browser origins for CORS (credentials are enabled). */
  corsOrigins: str('CORS_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  jwt: {
    secret: JWT_SECRET,
    expiresIn: str('JWT_EXPIRES_IN', '30d'),
  },

  cookie: {
    name: str('COOKIE_NAME', 'bisons_session'),
    /** Empty for localhost; set to the shared parent domain in production. */
    domain: str('COOKIE_DOMAIN', '') || undefined,
    secure: bool('COOKIE_SECURE', isProduction),
    /** Cookies that must cross sites (app. → api.) need "none" + secure. */
    sameSite: str('COOKIE_SAME_SITE', 'lax').toLowerCase(),
  },

  subscription: {
    trialDays: num('TRIAL_DAYS', 5),
    warningDays: num('SUBSCRIPTION_WARNING_DAYS', 3),
  },

  email: {
    enabled: bool('EMAIL_ENABLED', false),
    from: str('EMAIL_FROM', 'BisonsEduCore360 <no-reply@bisonstechs.com>'),
    replyTo: str('EMAIL_REPLY_TO', ''),
    /** Resend API key — https://resend.com/api-keys */
    resendApiKey: str('RESEND_API_KEY'),
  },

  brand: {
    name: str('BRAND_NAME', 'BisonsTechs'),
    productName: str('PRODUCT_NAME', 'BisonsEduCore360'),
    /** Absolute HTTPS URL used in platform emails (welcome, system). */
    logoUrl: str(
      'BRAND_LOGO_URL',
      'https://bisonstechs.com/logo.png'
    ),
    website: str('BRAND_WEBSITE', 'https://bisonstechs.com'),
    appUrl: str('APP_URL', 'http://localhost:3000'),
    supportEmail: str('SUPPORT_EMAIL', 'support@bisonstechs.com'),
  },

  cloudinary: {
    enabled: bool('CLOUDINARY_ENABLED', false),
    cloudName: str('CLOUDINARY_CLOUD_NAME'),
    apiKey: str('CLOUDINARY_API_KEY'),
    apiSecret: str('CLOUDINARY_API_SECRET'),
    folder: str('CLOUDINARY_FOLDER', 'bisonseducore360'),
  },
};

module.exports = env;

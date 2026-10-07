/**
 * JWT + session-cookie helpers.
 *
 * The browser client authenticates with an httpOnly cookie, which means the
 * token is never readable from JavaScript (XSS cannot exfiltrate it). API
 * clients (mobile, Postman, server-to-server) may send the same token as
 * `Authorization: Bearer <token>`; the auth middleware accepts either.
 */

const jwt = require('jsonwebtoken');
const env = require('../config/env');

const COOKIE_NAME = env.cookie.name;
const DEFAULT_MAX_AGE_DAYS = 30;

/** Sign an access token for a user. */
function signToken(payload) {
  return jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
}

/** Verify a token, throwing a jsonwebtoken error when invalid/expired. */
function verifyToken(token) {
  return jwt.verify(token, env.jwt.secret);
}

/** Base cookie attributes shared by set + clear. */
function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.cookie.secure,
    sameSite: env.cookie.sameSite,
    path: '/',
    ...(env.cookie.domain ? { domain: env.cookie.domain } : {}),
  };
}

/**
 * Write the session cookie.
 *
 * `maxAgeDays` is what makes the login screen's "Remember me" real:
 *   • a positive number → persistent cookie that survives browser restarts
 *   • `null`            → `maxAge` is omitted, so the browser stores a SESSION
 *                         cookie and discards it when it closes
 */
function setSessionCookie(res, token, { maxAgeDays = DEFAULT_MAX_AGE_DAYS } = {}) {
  const options = cookieOptions();
  if (maxAgeDays !== null) {
    options.maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
  }
  res.cookie(COOKIE_NAME, token, options);
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
}

/** Cookie first (browser), then `Authorization: Bearer` (API clients). */
function readTokenFromRequest(req) {
  const fromCookie = req.cookies?.[COOKIE_NAME];
  if (fromCookie) return String(fromCookie).trim();

  const header = req.headers?.authorization || '';
  if (header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

module.exports = {
  COOKIE_NAME,
  signToken,
  verifyToken,
  cookieOptions,
  setSessionCookie,
  clearSessionCookie,
  readTokenFromRequest,
};
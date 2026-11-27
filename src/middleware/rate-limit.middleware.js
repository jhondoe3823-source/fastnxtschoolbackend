/**
 * Small in-memory rate limiter (no external dependency).
 *
 * Intended to blunt credential-stuffing against /auth/login and /auth/register.
 * A single-process map is enough for one instance; behind multiple instances or
 * serverless, move the counter to Redis — the call sites do not change.
 */

const ApiResponse = require('../utils/response');

const buckets = new Map();

// Periodically drop empty buckets so the map cannot grow forever.
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, CLEANUP_INTERVAL_MS);
cleanupTimer.unref?.();

const clientKey = (req, suffix) => `${req.ip || req.socket?.remoteAddress || 'unknown'}:${suffix}`;

/** Human-readable wait label, e.g. "45 seconds" or "12 minutes". */
function formatWait(seconds) {
  const secs = Math.max(1, Math.ceil(Number(seconds) || 0));
  if (secs < 60) {
    return `${secs} second${secs === 1 ? '' : 's'}`;
  }
  const minutes = Math.ceil(secs / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/**
 * Build the client-facing message with an exact retry window.
 * Supports `{wait}` in `message`, otherwise appends the wait hint.
 */
function messageWithWait(message, retryAfterSec) {
  const wait = formatWait(retryAfterSec);
  if (typeof message === 'function') {
    return message(retryAfterSec, wait);
  }
  const base = String(message || 'Too many attempts.');
  if (base.includes('{wait}')) {
    return base.replaceAll('{wait}', wait);
  }
  const cleaned = base
    .replace(/\s*Please (wait a few minutes and try again|try again later|try again in a few minutes)\.?$/i, '')
    .trim()
    .replace(/\.$/, '');
  return `${cleaned || 'Too many attempts'}. Please wait ${wait} and try again.`;
}

/**
 * @param {{ windowMs?: number, max?: number, message?: string | ((retryAfterSec: number, waitLabel: string) => string), key?: string }} options
 */
function rateLimit({
  windowMs = 15 * 60 * 1000,
  max = 20,
  message = 'Too many attempts. Please try again in a few minutes.',
  key = 'global',
} = {}) {
  return (req, res, next) => {
    const bucketKey = clientKey(req, key);
    const now = Date.now();

    let bucket = buckets.get(bucketKey);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(bucketKey, bucket);
    }

    bucket.count += 1;

    const remaining = Math.max(0, max - bucket.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return ApiResponse.tooManyRequests(res, messageWithWait(message, retryAfter));
    }

    return next();
  };
}

module.exports = { rateLimit, formatWait };

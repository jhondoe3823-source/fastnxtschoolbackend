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

/**
 * @param {{ windowMs?: number, max?: number, message?: string, key?: string }} options
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
      return ApiResponse.tooManyRequests(res, message);
    }

    return next();
  };
}

module.exports = { rateLimit };

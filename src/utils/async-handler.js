/**
 * Wraps an async route handler so any rejected promise is forwarded to the
 * Express error handler instead of crashing the process.
 *
 * Express 5 forwards rejected promises on its own, but keeping this wrapper
 * makes the intent explicit and keeps behaviour identical on Express 4.
 *
 *   router.get('/', asyncHandler(async (req, res) => { ... }));
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;

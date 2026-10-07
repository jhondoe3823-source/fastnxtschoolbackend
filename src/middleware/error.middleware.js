/**
 * Error handling — the last two middleware in the stack.
 *
 * `notFoundHandler` catches unmatched routes; `errorHandler` converts anything
 * thrown downstream into the standard response envelope. Anything that is not
 * an AppError is logged in full and reported as a generic 500, so stack traces
 * and database internals never reach the client.
 */

const ApiResponse = require('../utils/response');
const { AppError, isAppError } = require('../utils/errors');
const logger = require('../utils/logger');
const env = require('../config/env');
const { ERROR_CODES } = require('../constants');

function notFoundHandler(req, res) {
  return ApiResponse.error(
    res,
    404,
    `Route ${req.method} ${req.originalUrl} not found`,
    null,
    ERROR_CODES.NOT_FOUND
  );
}

/** Translate Prisma's known error codes into HTTP semantics. */
function fromPrismaError(error) {
  switch (error.code) {
    case 'P2002':
      return new AppError(
        'That record already exists.',
        409,
        ERROR_CODES.CONFLICT
      );
    case 'P2025':
      return new AppError('Resource not found.', 404, ERROR_CODES.NOT_FOUND);
    case 'P2003':
      return new AppError(
        'Related record not found.',
        400,
        ERROR_CODES.VALIDATION_ERROR
      );
    default:
      return null;
  }
}

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
function errorHandler(error, req, res, next) {
  // A rejected CORS origin is a client-side misconfiguration, not a server bug.
  if (
    !isAppError(error) &&
    typeof error?.message === 'string' &&
    error.message.includes('is not allowed by CORS')
  ) {
    return ApiResponse.forbidden(res, error.message);
  }

  let resolved = isAppError(error) ? error : fromPrismaError(error);

  if (!resolved) {
    logger.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, error);
    resolved = new AppError(
      env.isProduction ? 'Something went wrong. Please try again.' : error.message,
      500,
      ERROR_CODES.INTERNAL
    );
  } else if (!resolved.isOperational) {
    logger.error('Unexpected application error:', error);
  }

  if (resolved.statusCode >= 500) {
    logger.error(resolved.message);
  }

  return ApiResponse.error(
    res,
    resolved.statusCode,
    resolved.message,
    resolved.errors,
    resolved.code
  );
}

module.exports = { notFoundHandler, errorHandler };

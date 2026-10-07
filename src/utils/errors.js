/**
 * Application errors.
 *
 * Services throw `AppError` (or one of the factories) and the error middleware
 * turns it into the standard response envelope. Anything that is *not* an
 * AppError is treated as a bug and reported as a generic 500 so internals never
 * leak to the client.
 */

const { HTTP_STATUS, ERROR_CODES } = require('../constants');

class AppError extends Error {
  /**
   * @param {string} message   Human-readable, safe to show the client.
   * @param {number} statusCode
   * @param {string} [code]    Machine-readable code for the client to branch on.
   * @param {Array}  [errors]  Field-level validation details.
   */
  constructor(message, statusCode = HTTP_STATUS.INTERNAL, code = null, errors = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

const badRequest = (message, errors) =>
  new AppError(message, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, errors);

const unauthorized = (message = 'Unauthorized', code = ERROR_CODES.UNAUTHORIZED) =>
  new AppError(message, HTTP_STATUS.UNAUTHORIZED, code);

const forbidden = (message = 'Forbidden', code = ERROR_CODES.FORBIDDEN) =>
  new AppError(message, HTTP_STATUS.FORBIDDEN, code);

const notFound = (message = 'Resource not found') =>
  new AppError(message, HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND);

const conflict = (message, code = ERROR_CODES.CONFLICT) =>
  new AppError(message, HTTP_STATUS.CONFLICT, code);

const isAppError = (error) => error instanceof AppError;

module.exports = {
  AppError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  isAppError,
};

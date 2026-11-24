

const { HTTP_STATUS } = require('../constants');

class ApiResponse {
  /** @param {import('express').Response} res */
  static success(res, statusCode, message, data = null, meta = null) {
    const body = { success: true, message, data };
    if (meta) body.meta = meta;
    return res.status(statusCode).json(body);
  }

  static error(res, statusCode, message, errors = null, code = null) {
    const body = { success: false, message };
    if (errors) body.errors = errors;
    if (code) body.code = code;
    return res.status(statusCode).json(body);
  }

  // ── Convenience helpers ────────────────────────────────────
  static ok(res, message, data) {
    return this.success(res, HTTP_STATUS.OK, message, data);
  }

  static created(res, message, data) {
    return this.success(res, HTTP_STATUS.CREATED, message, data);
  }

  static badRequest(res, message, errors) {
    return this.error(res, HTTP_STATUS.BAD_REQUEST, message, errors, 'VALIDATION_ERROR');
  }

  static unauthorized(res, message = 'Unauthorized', code = 'UNAUTHORIZED') {
    return this.error(res, HTTP_STATUS.UNAUTHORIZED, message, null, code);
  }

  static forbidden(res, message = 'Forbidden', code = 'FORBIDDEN') {
    return this.error(res, HTTP_STATUS.FORBIDDEN, message, null, code);
  }

  static notFound(res, message = 'Resource not found') {
    return this.error(res, HTTP_STATUS.NOT_FOUND, message, null, 'NOT_FOUND');
  }

  static conflict(res, message, code = 'CONFLICT') {
    return this.error(res, HTTP_STATUS.CONFLICT, message, null, code);
  }

  static tooManyRequests(res, message = 'Too many requests') {
    return this.error(res, HTTP_STATUS.TOO_MANY_REQUESTS, message, null, 'RATE_LIMITED');
  }

  static serverError(res, message = 'Internal server error') {
    return this.error(res, HTTP_STATUS.INTERNAL, message, null, 'INTERNAL_ERROR');
  }
}

module.exports = ApiResponse;

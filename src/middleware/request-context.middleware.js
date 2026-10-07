/**
 * Request context: gives every request an id, echoed back in `X-Request-Id`
 * and included in logs so a client error can be traced to a server log line.
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

function requestContext(req, res, next) {
  const incoming = req.headers['x-request-id'];
  const requestId = typeof incoming === 'string' && incoming.trim() ? incoming.trim() : crypto.randomUUID();

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms`;
    const message = `[${requestId}] ${line}`;

    if (res.statusCode >= 500) logger.error(message);
    else if (res.statusCode >= 400) logger.warn(message);
    else logger.debug(message);
  });

  return next();
}

module.exports = { requestContext };

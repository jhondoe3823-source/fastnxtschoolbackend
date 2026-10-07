/**
 * Tiny dependency-free logger with levels.
 *
 * Keeps request/DB noise quiet in tests and prevents `console.*` calls from
 * scattering across the codebase.
 */

const env = require('../config/env');

const LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };

const configuredLevel =
  process.env.LOG_LEVEL ||
  (env.nodeEnv === 'test' ? 'silent' : env.isProduction ? 'info' : 'debug');

const threshold = LEVELS[configuredLevel] ?? LEVELS.info;

const stamp = () => new Date().toISOString();

const logger = {
  error: (...args) => {
    if (threshold >= LEVELS.error) console.error(`[${stamp()}] ERROR`, ...args);
  },
  warn: (...args) => {
    if (threshold >= LEVELS.warn) console.warn(`[${stamp()}] WARN `, ...args);
  },
  info: (...args) => {
    if (threshold >= LEVELS.info) console.log(`[${stamp()}] INFO `, ...args);
  },
  debug: (...args) => {
    if (threshold >= LEVELS.debug) console.log(`[${stamp()}] DEBUG`, ...args);
  },
};

module.exports = logger;

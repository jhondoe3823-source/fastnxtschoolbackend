/**
 * Server entry point — `node src/server.js` (or `npm run dev`).
 *
 * Verifies the database before accepting traffic, then shuts down gracefully so
 * nodemon restarts do not leave dangling Prisma connections.
 */

require('./config/env');

const app = require('./app');
const logger = require('./utils/logger');
const env = require('./config/env');
const { connectDatabase, disconnectDatabase } = require('./config/database');

async function start() {
  try {
    await connectDatabase();
  } catch (error) {
    logger.error('Startup aborted — the database is not reachable.');
    process.exit(1);
  }

  const server = app.listen(env.port, env.host, () => {
    logger.info(`FastNxt API listening on http://${env.host}:${env.port} (${env.nodeEnv})`);
    logger.info(`Allowed origins: ${env.corsOrigins.join(', ') || '(none configured)'}`);
    logger.info(`Trial length: ${env.subscription.trialDays} day(s).`);
  });

  const shutdown = (signal) => () => {
    logger.info(`${signal} received — closing the server.`);
    server.close(async () => {
      await disconnectDatabase();
      logger.info('Server closed cleanly.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown('SIGINT'));
  process.on('SIGTERM', shutdown('SIGTERM'));

  return server;
}

start();

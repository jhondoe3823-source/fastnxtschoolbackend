/**
 * CORS configuration.
 *
 * The frontend and the API are separate origins, and the browser must be able
 * to send the httpOnly session cookie — so credentials are enabled and the
 * allowed origins are an explicit allow-list (never "*" together with
 * credentials, which browsers reject).
 */

const env = require('./env');

const corsOptions = {
  origin(origin, callback) {
    // Same-origin, server-to-server and curl requests send no Origin header.
    if (!origin) return callback(null, true);

    if (env.corsOrigins.includes('*') || env.corsOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin "${origin}" is not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 86_400,
};

module.exports = { corsOptions };

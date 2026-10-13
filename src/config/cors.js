/**
 * CORS configuration.
 *
 * The frontend and the API are separate origins, and the browser must be able
 * to send the httpOnly session cookie — so credentials are enabled and the
 * allowed origins are an explicit allow-list (never "*" together with
 * credentials, which browsers reject).
 *
 * Entries may be exact origins, or end with `*` as a prefix wildcard
 * (e.g. `https://bisonseducore360-admin*.vercel.app` for Vercel previews).
 */

const env = require('./env');

function isOriginAllowed(origin) {
  const allowed = env.corsOrigins;
  if (allowed.includes('*') || allowed.includes(origin)) return true;

  return allowed.some((entry) => {
    if (!entry.endsWith('*')) return false;
    const prefix = entry.slice(0, -1);
    return origin.startsWith(prefix);
  });
}

const corsOptions = {
  origin(origin, callback) {
    // Same-origin, server-to-server and curl requests send no Origin header.
    if (!origin) return callback(null, true);

    if (isOriginAllowed(origin)) {
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

module.exports = { corsOptions, isOriginAllowed };

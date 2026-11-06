/**
 * Express application.
 *
 * Kept free of `listen()` so it can be imported by tests and by serverless
 * adapters (Vercel/Netlify) without starting a socket.
 *
 * Middleware order matters:
 *   request context → CORS → body parsers → cookies → routes → 404 → errors
 */

require('./config/env');

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { corsOptions } = require('./config/cors');
const { requestContext } = require('./middleware/request-context.middleware');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');
const routes = require('./routes');

const app = express();

app.disable('x-powered-by');
// Behind Railway/Vercel/nginx: trust the proxy so req.ip and secure cookies work.
app.set('trust proxy', 1);

app.use(requestContext);

// CORS must run before the routes so preflight OPTIONS requests are answered,
// and before any handler can write an error body.
app.use(cors(corsOptions));

// Larger limit so teachers can submit question paper PDFs/images as base64.
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));
app.use(cookieParser());

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'FastNxt API is running',
    data: { version: '0.1.0', docs: '/api/health' },
  });
});

app.use('/api', routes);

// Order matters: 404 first, then the error handler (both are terminal).
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;

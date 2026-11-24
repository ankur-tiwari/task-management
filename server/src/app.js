'use strict';
const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { createUserRepo } = require('./repositories/userRepo');
const { createTaskRepo } = require('./repositories/taskRepo');
const { createAuthRouter } = require('./routes/auth');
const { createUsersRouter } = require('./routes/users');
const { createTasksRouter } = require('./routes/tasks');
const { csrfProtection } = require('./middleware/csrf');
const { apiLimiter } = require('./middleware/rateLimit');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

function createApp(db) {
  const app = express();
  const userRepo = createUserRepo(db);
  const taskRepo = createTaskRepo(db);

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'"],
        'img-src': ["'self'", 'data:'], // data: for the MFA QR code
        'connect-src': ["'self'"],
        'object-src': ["'none'"],
        'frame-ancestors': ["'none'"],
        'form-action': ["'self'"],
        'base-uri': ["'self'"],
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
    strictTransportSecurity: config.isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
  }));

  app.use(cors({
    // Exact-match allow-list of one origin; any other origin gets no CORS headers. Never '*'.
    origin: (origin, cb) => cb(null, origin === config.clientOrigin),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
    maxAge: 600,
  }));

  if (!config.isTest) {
    // Minimal access log: method, path (no query string), status, duration. No bodies/headers/cookies.
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`));
      next();
    });
  }

  app.use(cookieParser());
  app.use(express.json({ limit: '10kb' }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api', apiLimiter, csrfProtection);
  app.use('/api/auth', createAuthRouter({ userRepo }));
  app.use('/api/users', createUsersRouter({ userRepo }));
  app.use('/api/tasks', createTasksRouter({ taskRepo, userRepo }));
  app.use('/api', notFoundHandler);

  // Optionally serve the built client (single-origin production deployment).
  const dist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };

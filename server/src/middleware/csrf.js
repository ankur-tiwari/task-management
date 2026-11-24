'use strict';
const crypto = require('node:crypto');
const config = require('../config');
const { AppError } = require('../utils/errors');
const { safeEqual } = require('../utils/crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const cookieOptions = () => ({
  httpOnly: true,
  secure: config.isProd,
  sameSite: 'strict',
  path: '/',
});

/** GET /api/auth/csrf — issues a fresh token (cookie + body). */
function issueCsrfToken(_req, res) {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(config.cookieNames.csrf, token, { ...cookieOptions(), maxAge: 24 * 60 * 60 * 1000 });
  res.set('Cache-Control', 'no-store');
  res.json({ csrf_token: token });
}

/**
 * Double-submit cookie + Origin check for every state-changing request.
 * The cookie is HttpOnly (script can't read it); the SPA receives the value
 * from issueCsrfToken and echoes it in the X-CSRF-Token header.
 */
function csrfProtection(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get('origin');
  if (origin && origin !== config.clientOrigin) {
    return next(new AppError(403, 'CSRF_INVALID', 'Cross-origin request blocked.'));
  }
  const cookieToken = req.cookies?.[config.cookieNames.csrf];
  const headerToken = req.get('x-csrf-token');
  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    return next(new AppError(403, 'CSRF_INVALID', 'Missing or invalid CSRF token.'));
  }
  next();
}

module.exports = { csrfProtection, issueCsrfToken, cookieOptions };

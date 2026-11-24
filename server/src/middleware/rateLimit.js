'use strict';
const rateLimit = require('express-rate-limit');
const config = require('../config');

const handler = (_req, res) =>
  res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } });

const base = { windowMs: config.rateLimit.windowMs, standardHeaders: 'draft-7', legacyHeaders: false, handler };

const apiLimiter = rateLimit({ ...base, limit: config.rateLimit.apiMax });
// Credential endpoints: strict, counted per IP.
const authLimiter = rateLimit({ ...base, limit: config.rateLimit.authMax });

module.exports = { apiLimiter, authLimiter };

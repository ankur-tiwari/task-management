'use strict';
const config = require('../config');
const { AppError } = require('../utils/errors');

function notFoundHandler(_req, _res, next) {
  next(new AppError(404, 'NOT_FOUND', 'Route not found.'));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' } });
  }
  // Log only the error name/message — never request bodies, headers, cookies or stacks with data.
  if (!config.isTest) console.error(`[error] ${err?.name || 'Error'}: ${err?.message || 'unknown'}`);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } });
}

module.exports = { notFoundHandler, errorHandler };

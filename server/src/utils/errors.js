'use strict';

class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const badRequest = (message, details) => new AppError(400, 'VALIDATION_ERROR', message, details);
const unauthorized = (message = 'Authentication required.') => new AppError(401, 'UNAUTHORIZED', message);
const forbidden = (message = 'You do not have permission to do that.') => new AppError(403, 'FORBIDDEN', message);
const notFound = (message = 'Resource not found.') => new AppError(404, 'NOT_FOUND', message);

module.exports = { AppError, badRequest, unauthorized, forbidden, notFound };

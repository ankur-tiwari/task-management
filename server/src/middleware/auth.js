'use strict';
const jwt = require('jsonwebtoken');
const config = require('../config');
const { unauthorized } = require('../utils/errors');

const VERIFY_BASE = { algorithms: ['HS256'], issuer: config.jwtIssuer };

function signSession(user) {
  return jwt.sign({ tv: user.token_version }, config.jwtSecret, {
    algorithm: 'HS256', issuer: config.jwtIssuer, audience: 'session',
    subject: user.id, expiresIn: config.sessionTtlSeconds,
  });
}

function signMfaChallenge(user) {
  return jwt.sign({}, config.jwtSecret, {
    algorithm: 'HS256', issuer: config.jwtIssuer, audience: 'mfa',
    subject: user.id, expiresIn: config.mfaTokenTtlSeconds,
  });
}

function verifyMfaChallenge(token) {
  try {
    return jwt.verify(token, config.jwtSecret, { ...VERIFY_BASE, audience: 'mfa' }).sub;
  } catch {
    return null;
  }
}

function requireAuth(userRepo) {
  return (req, _res, next) => {
    const token = req.cookies?.[config.cookieNames.session];
    if (!token) return next(unauthorized());
    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret, { ...VERIFY_BASE, audience: 'session' });
    } catch {
      return next(unauthorized('Session expired. Please sign in again.'));
    }
    const user = userRepo.findById(payload.sub);
    // token_version lets logout / MFA changes revoke every outstanding token.
    if (!user || user.token_version !== payload.tv) return next(unauthorized());
    req.user = user;
    next();
  };
}

module.exports = { signSession, signMfaChallenge, verifyMfaChallenge, requireAuth };

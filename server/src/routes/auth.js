'use strict';
const express = require('express');
const argon2 = require('argon2');
const QRCode = require('qrcode');
const config = require('../config');
const { validate } = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimit');
const { issueCsrfToken, cookieOptions } = require('../middleware/csrf');
const { signSession, signMfaChallenge, verifyMfaChallenge, requireAuth } = require('../middleware/auth');
const { AppError } = require('../utils/errors');
const { encrypt, decrypt, generateTotpSecret, verifyTotp, totpUri } = require('../utils/crypto');
const v = require('../validators/auth');

const INVALID_LOGIN = () => new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials or account temporarily locked.');

function createAuthRouter({ userRepo }) {
  const router = express.Router();
  const auth = requireAuth(userRepo);

  // Used to burn equal CPU time when the email is unknown (anti user-enumeration timing).
  const dummyHashPromise = argon2.hash(`dummy-${Math.random()}`, { type: argon2.argon2id });

  const isLocked = (u) => Boolean(u.locked_until) && new Date(u.locked_until) > new Date();
  const setSessionCookie = (res, user) =>
    res.cookie(config.cookieNames.session, signSession(user), { ...cookieOptions(), maxAge: config.sessionTtlSeconds * 1000 });
  const publicUser = (u) => userRepo.findPublicById(u.id);
  const fail = (user) => userRepo.recordFailure(user.id, config.lockout);

  router.get('/csrf', issueCsrfToken);

  router.post('/register', authLimiter, validate({ body: v.registerSchema }), async (req, res) => {
    const { first_name, last_name, email, password } = req.valid.body;
    const password_hash = await argon2.hash(password, { type: argon2.argon2id });
    try {
      const user = userRepo.create({ first_name, last_name, email, password_hash });
      res.status(201).json({ data: user });
    } catch (err) {
      if (String(err?.code).startsWith('SQLITE_CONSTRAINT')) {
        // Generic message: do not confirm whether the email is registered.
        throw new AppError(409, 'REGISTRATION_FAILED', 'Registration failed. If you already have an account, please sign in.');
      }
      throw err;
    }
  });

  router.post('/login', authLimiter, validate({ body: v.loginSchema }), async (req, res) => {
    const { email, password } = req.valid.body;
    let user = userRepo.findByEmail(email);
    if (user && user.locked_until && !isLocked(user)) {
      userRepo.clearFailures(user.id); // lock expired
      user = userRepo.findById(user.id);
    }
    const hash = user ? user.password_hash : await dummyHashPromise;
    const passwordOk = await argon2.verify(hash, password);
    if (!user || isLocked(user) || !passwordOk) {
      if (user && !isLocked(user)) fail(user);
      throw INVALID_LOGIN();
    }
    if (user.mfa_enabled) {
      return res.json({ data: { mfa_required: true, mfa_token: signMfaChallenge(user) } });
    }
    userRepo.clearFailures(user.id);
    setSessionCookie(res, user);
    res.json({ data: { mfa_required: false, user: publicUser(user) } });
  });

  router.post('/mfa/login', authLimiter, validate({ body: v.mfaLoginSchema }), (req, res) => {
    const { mfa_token, code } = req.valid.body;
    const userId = verifyMfaChallenge(mfa_token);
    const user = userId && userRepo.findById(userId);
    if (!user || !user.mfa_enabled || !user.mfa_secret_enc || isLocked(user)) throw INVALID_LOGIN();

    const step = verifyTotp(decrypt(user.mfa_secret_enc, config.mfaKey), code);
    // Reject replays: each 30s step may be used once.
    if (step === null || step <= user.mfa_last_step) {
      fail(user);
      throw INVALID_LOGIN();
    }
    userRepo.setLastStep(user.id, step);
    userRepo.clearFailures(user.id);
    setSessionCookie(res, user);
    res.json({ data: { mfa_required: false, user: publicUser(user) } });
  });

  router.post('/logout', (req, res) => {
    auth(req, res, (err) => {
      if (!err) userRepo.bumpTokenVersion(req.user.id); // revoke token server-side
      res.clearCookie(config.cookieNames.session, cookieOptions());
      res.status(204).end();
    });
  });

  router.get('/me', auth, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ data: publicUser(req.user) });
  });

  // ---- MFA management (TOTP) ------------------------------------------------
  router.post('/mfa/setup', auth, authLimiter, async (req, res) => {
    if (req.user.mfa_enabled) throw new AppError(409, 'MFA_ALREADY_ENABLED', 'Two-factor authentication is already enabled.');
    const secret = generateTotpSecret();
    userRepo.setMfaSecret(req.user.id, encrypt(secret, config.mfaKey));
    const otpauth_url = totpUri(secret, req.user.email);
    res.set('Cache-Control', 'no-store');
    res.json({ data: { secret, otpauth_url, qr_data_url: await QRCode.toDataURL(otpauth_url) } });
  });

  router.post('/mfa/enable', auth, authLimiter, validate({ body: v.mfaEnableSchema }), (req, res) => {
    const user = req.user;
    if (user.mfa_enabled || !user.mfa_secret_enc) throw new AppError(409, 'MFA_SETUP_REQUIRED', 'Start two-factor setup first.');
    const step = verifyTotp(decrypt(user.mfa_secret_enc, config.mfaKey), req.valid.body.code);
    if (step === null) throw new AppError(400, 'INVALID_CODE', 'That code is not valid. Try again.');
    userRepo.enableMfa(user.id, step); // also revokes other sessions
    setSessionCookie(res, userRepo.findById(user.id));
    res.json({ data: publicUser(user) });
  });

  router.post('/mfa/disable', auth, authLimiter, validate({ body: v.mfaDisableSchema }), async (req, res) => {
    const user = req.user;
    const { password, code } = req.valid.body;
    if (!user.mfa_enabled) throw new AppError(409, 'MFA_NOT_ENABLED', 'Two-factor authentication is not enabled.');
    const passwordOk = await argon2.verify(user.password_hash, password);
    const step = verifyTotp(decrypt(user.mfa_secret_enc, config.mfaKey), code);
    if (!passwordOk || step === null || step <= user.mfa_last_step) {
      throw new AppError(400, 'INVALID_CREDENTIALS', 'Password or code is incorrect.');
    }
    userRepo.disableMfa(user.id);
    setSessionCookie(res, userRepo.findById(user.id));
    res.json({ data: publicUser(user) });
  });

  return router;
}

module.exports = { createAuthRouter };

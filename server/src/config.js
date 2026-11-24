'use strict';
require('dotenv').config({ quiet: true });

const WEAK_SECRETS = new Set(['changeme', 'secret', 'password', 'your_super_secret_jwt_key']);

function fail(message) {
  // Never print secret values, only what is wrong.
  console.error(`[config] ${message}`);
  process.exit(1);
}

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';
const isTest = env === 'test';

const jwtSecret = process.env.JWT_SECRET || '';
if (jwtSecret.length < 32 || WEAK_SECRETS.has(jwtSecret.toLowerCase())) {
  fail('JWT_SECRET must be set to a random value of at least 32 characters.');
}

const mfaKeyHex = process.env.MFA_ENCRYPTION_KEY || '';
if (!/^[0-9a-fA-F]{64}$/.test(mfaKeyHex)) {
  fail('MFA_ENCRYPTION_KEY must be 64 hex characters (32 bytes).');
}

const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
try {
  const u = new URL(clientOrigin);
  if (u.origin !== clientOrigin) throw new Error('not an origin');
} catch {
  fail('CLIENT_ORIGIN must be an exact origin such as https://tasks.example.com (no path or trailing slash).');
}
if (isProd && !clientOrigin.startsWith('https://')) {
  fail('CLIENT_ORIGIN must use https in production.');
}

const int = (name, fallback) => {
  const n = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

module.exports = Object.freeze({
  env,
  isProd,
  isTest,
  port: int('PORT', 4000),
  clientOrigin,
  databasePath: process.env.DATABASE_PATH || './data/tasks.db',
  trustProxy: int('TRUST_PROXY', 0),
  jwtSecret,
  mfaKey: Buffer.from(mfaKeyHex, 'hex'),
  jwtIssuer: 'task-manager',
  sessionTtlSeconds: 60 * 60, // 1 hour
  mfaTokenTtlSeconds: 5 * 60,
  cookieNames: {
    session: isProd ? '__Host-session' : 'session',
    csrf: isProd ? '__Host-csrf' : 'csrf',
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    apiMax: int('RATE_LIMIT_API_MAX', 300),
    authMax: int('RATE_LIMIT_AUTH_MAX', 10),
  },
  lockout: { maxAttempts: 5, durationMs: 15 * 60 * 1000 },
});

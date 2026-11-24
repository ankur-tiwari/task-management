'use strict';
const { z } = require('zod');

const name = (label) =>
  z.string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(50, `${label} must be at most 50 characters.`)
    .regex(/^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u, `${label} contains invalid characters.`);

const email = z.string({ error: 'Email is required.' })
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long.')
  .pipe(z.email('Enter a valid email address.'));

// max 128 guards against hashing-DoS with huge inputs
const strongPassword = z.string({ error: 'Password is required.' })
  .min(12, 'Password must be at least 12 characters.')
  .max(128, 'Password must be at most 128 characters.')
  .regex(/[a-z]/, 'Password must contain a lowercase letter.')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter.')
  .regex(/\d/, 'Password must contain a number.')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a symbol.');

const totpCode = z.string({ error: 'Code is required.' })
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code.');

const registerSchema = z.strictObject({
  first_name: name('First name'),
  last_name: name('Last name'),
  email,
  password: strongPassword,
});

const loginSchema = z.strictObject({
  email,
  // Do not enforce complexity on login; only bound the size.
  password: z.string({ error: 'Password is required.' }).min(1, 'Password is required.').max(128),
});

const mfaLoginSchema = z.strictObject({
  mfa_token: z.string().min(10).max(2048),
  code: totpCode,
});

const mfaEnableSchema = z.strictObject({ code: totpCode });

const mfaDisableSchema = z.strictObject({
  password: z.string().min(1, 'Password is required.').max(128),
  code: totpCode,
});

module.exports = { registerSchema, loginSchema, mfaLoginSchema, mfaEnableSchema, mfaDisableSchema };

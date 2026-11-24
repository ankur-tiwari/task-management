'use strict';
const crypto = require('node:crypto');

const PUBLIC_COLUMNS = 'id, first_name, last_name, email, mfa_enabled, created_at';

function createUserRepo(db) {
  const stmts = {
    insert: db.prepare(`INSERT INTO users (id, first_name, last_name, email, password_hash)
                        VALUES (@id, @first_name, @last_name, @email, @password_hash)`),
    byEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    byId: db.prepare('SELECT * FROM users WHERE id = ?'),
    publicById: db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ?`),
    directory: db.prepare('SELECT id, first_name, last_name FROM users ORDER BY first_name, last_name LIMIT 500'),
    recordFailure: db.prepare(`UPDATE users SET failed_attempts = failed_attempts + 1,
        locked_until = CASE WHEN failed_attempts + 1 >= @max THEN @until ELSE locked_until END,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = @id`),
    clearFailures: db.prepare(`UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?`),
    bumpTokenVersion: db.prepare(`UPDATE users SET token_version = token_version + 1,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`),
    setMfaSecret: db.prepare(`UPDATE users SET mfa_secret_enc = ?, mfa_enabled = 0, mfa_last_step = 0,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`),
    enableMfa: db.prepare(`UPDATE users SET mfa_enabled = 1, mfa_last_step = ?, token_version = token_version + 1,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`),
    disableMfa: db.prepare(`UPDATE users SET mfa_enabled = 0, mfa_secret_enc = NULL, mfa_last_step = 0,
        token_version = token_version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`),
    setLastStep: db.prepare('UPDATE users SET mfa_last_step = ? WHERE id = ?'),
  };

  return {
    create({ first_name, last_name, email, password_hash }) {
      const id = crypto.randomUUID();
      stmts.insert.run({ id, first_name, last_name, email, password_hash });
      return stmts.publicById.get(id);
    },
    findByEmail: (email) => stmts.byEmail.get(email),
    findById: (id) => stmts.byId.get(id),
    findPublicById: (id) => stmts.publicById.get(id),
    directory: () => stmts.directory.all(),
    exists: (id) => Boolean(stmts.publicById.get(id)),
    recordFailure(id, { maxAttempts, durationMs }) {
      stmts.recordFailure.run({ id, max: maxAttempts, until: new Date(Date.now() + durationMs).toISOString() });
    },
    clearFailures: (id) => stmts.clearFailures.run(id),
    bumpTokenVersion: (id) => stmts.bumpTokenVersion.run(id),
    setMfaSecret: (id, enc) => stmts.setMfaSecret.run(enc, id),
    enableMfa: (id, step) => stmts.enableMfa.run(step, id),
    disableMfa: (id) => stmts.disableMfa.run(id),
    setLastStep: (id, step) => stmts.setLastStep.run(step, id),
  };
}

module.exports = { createUserRepo };

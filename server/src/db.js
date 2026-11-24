'use strict';
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id               TEXT PRIMARY KEY,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  email            TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash    TEXT NOT NULL,
  mfa_secret_enc   TEXT,
  mfa_enabled      INTEGER NOT NULL DEFAULT 0 CHECK (mfa_enabled IN (0,1)),
  mfa_last_step    INTEGER NOT NULL DEFAULT 0,
  failed_attempts  INTEGER NOT NULL DEFAULT 0,
  locked_until     TEXT,
  token_version    INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (${NOW}),
  updated_at       TEXT NOT NULL DEFAULT (${NOW})
);

CREATE TABLE IF NOT EXISTS tasks (
  id           TEXT PRIMARY KEY,
  task_name    TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  due_date     TEXT,
  status       TEXT NOT NULL DEFAULT 'Pending'
               CHECK (status IN ('Pending','In-progress','Completed','Blocked')),
  created_by   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_to  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT (${NOW}),
  updated_at   TEXT NOT NULL DEFAULT (${NOW})
);

CREATE INDEX IF NOT EXISTS idx_tasks_created_by  ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status      ON tasks(status);
`;

function openDatabase(file) {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  }
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  if (file !== ':memory:') {
    try { fs.chmodSync(file, 0o600); } catch { /* best effort on non-POSIX */ }
  }
  return db;
}

module.exports = { openDatabase };

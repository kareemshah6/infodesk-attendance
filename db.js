'use strict';
// Database layer - uses Node's built-in SQLite (no external database server needed).
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'attendance.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS batches (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  course      TEXT,
  timing      TEXT,
  teacher_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','staff','partner','student')),
  phone         TEXT,
  designation   TEXT,
  batch_id      INTEGER REFERENCES batches(id) ON DELETE SET NULL,
  join_date     TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  must_change   INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('present','late','absent','leave')),
  check_in   TEXT,
  check_out  TEXT,
  method     TEXT,
  marked_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  note       TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
`);

const DEFAULT_SETTINGS = {
  institute_name: 'Infodesk Computer Education',
  timezone: process.env.TZ_NAME || 'Asia/Kolkata',
  late_after: '09:45',
  require_qr: '1',
  qr_secret: crypto.randomBytes(32).toString('hex'),
  kiosk_key: crypto.randomBytes(16).toString('hex'),
};
const insSetting = db.prepare('INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insSetting.run(k, v);

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : DEFAULT_SETTINGS[key];
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, String(value));
}

function tx(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// First run: create the admin account.
if (!db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  db.prepare(`INSERT INTO users (name, username, password_hash, role, designation, must_change)
              VALUES ('Administrator', 'admin', ?, 'admin', 'Director', 1)`)
    .run(bcrypt.hashSync(password, 10));
  console.log(`Created admin account -> username: admin  password: ${process.env.ADMIN_PASSWORD ? '(from ADMIN_PASSWORD)' : 'admin123'}`);
}

module.exports = { db, tx, getSetting, setSetting };

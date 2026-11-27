'use strict';
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const { db, tx, getSetting, setSetting } = require('./db');

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '1mb' }));

const ROLES = ['admin', 'staff', 'partner', 'student'];
const STATUSES = ['present', 'late', 'absent', 'leave'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const QR_WINDOW_SECONDS = 60;      // QR code changes every minute
const QR_GRACE_WINDOWS = 2;        // ...and stays valid ~2 minutes after it disappears
const STAFF_ROLL_DAYS = 7;         // teachers can correct roll call up to 7 days back

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new HttpError(status, message); };

// ---------- helpers ----------
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const str = (v, max = 200) => (v == null ? '' : String(v).trim().slice(0, max));
const optStr = (v, max = 200) => str(v, max) || null;
const toInt = (v) => (v === '' || v == null ? null : Number.isInteger(Number(v)) ? Number(v) : NaN);

function now() {
  let tz = getSetting('timezone');
  let fmt;
  try {
    fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  } catch {
    fmt = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  }
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
const addDays = (date, n) => {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
function checkDate(d, label = 'date') {
  if (!DATE_RE.test(d || '') || Number.isNaN(Date.parse(d))) fail(400, `Invalid ${label}`);
  return d;
}
const time12 = (t) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
function publicUser(u) {
  if (!u) return u;
  const { password_hash, ...rest } = u;
  return rest;
}

// Rotating QR code: a 6-digit code derived from a secret and the current minute.
function qrCodeFor(windowOffset = 0) {
  const w = Math.floor(Date.now() / 1000 / QR_WINDOW_SECONDS) + windowOffset;
  const h = crypto.createHmac('sha256', getSetting('qr_secret')).update(String(w)).digest();
  return String(h.readUInt32BE(0) % 1_000_000).padStart(6, '0');
}
function isValidQrCode(code) {
  code = str(code, 20);
  if (!/^\d{6}$/.test(code)) return false;
  for (let o = 0; o >= -QR_GRACE_WINDOWS; o--) if (qrCodeFor(o) === code) return true;
  return false;
}
async function qrPayload(req) {
  const code = qrCodeFor(0);
  const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  const url = `${base.replace(/\/$/, '')}/?code=${code}`;
  const image = await QRCode.toDataURL(url, { width: 600, margin: 2, errorCorrectionLevel: 'M' });
  const secondsLeft = QR_WINDOW_SECONDS - (Math.floor(Date.now() / 1000) % QR_WINDOW_SECONDS);
  return { code, url, image, secondsLeft, institute: getSetting('institute_name') };
}

// ---------- auth ----------
const loginFailures = new Map(); // key -> { count, until }
function auth(req, res, next) {
  const h = req.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) fail(401, 'Please log in');
  const user = db.prepare(`
    SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND u.active = 1 AND s.created_at > datetime('now', '-30 days')`).get(sha(token));
  if (!user) fail(401, 'Your session has expired. Please log in again.');
  req.user = user;
  req.tokenHash = sha(token);
  next();
}
const allow = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(new HttpError(403, 'You do not have access to this.'));

app.post('/api/login', (req, res) => {
  const username = str(req.body?.username, 60);
  const password = String(req.body?.password ?? '');
  if (!username || !password) fail(400, 'Enter your username and password.');

  const key = `${req.ip}|${username.toLowerCase()}`;
  const f = loginFailures.get(key);
  if (f && f.count >= 8 && f.until > Date.now()) fail(429, 'Too many failed attempts. Try again in 15 minutes.');

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    const cur = f && f.until > Date.now() ? f : { count: 0 };
    loginFailures.set(key, { count: cur.count + 1, until: Date.now() + 15 * 60 * 1000 });
    fail(401, 'Wrong username or password.');
  }
  if (!user.active) fail(403, 'This account is deactivated. Please contact the office.');
  loginFailures.delete(key);

  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(sha(token), user.id);
  db.prepare(`DELETE FROM sessions WHERE created_at < datetime('now', '-30 days')`).run();
  res.json({ token, user: publicUser(user) });
});

app.post('/api/logout', auth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(req.tokenHash);
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => {
  const batch = req.user.batch_id ? db.prepare('SELECT id, name, course, timing FROM batches WHERE id = ?').get(req.user.batch_id) : null;
  const { date, time } = now();
  const todayRecord = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(req.user.id, date) || null;
  res.json({
    user: { ...publicUser(req.user), batch },
    settings: {
      institute_name: getSetting('institute_name'),
      require_qr: getSetting('require_qr') === '1',
      late_after: getSetting('late_after'),
    },
    today: date, time, todayRecord,
  });
});

app.post('/api/me/password', auth, (req, res) => {
  const current = String(req.body?.current ?? '');
  const next = String(req.body?.password ?? '');
  if (!bcrypt.compareSync(current, req.user.password_hash)) fail(400, 'Current password is incorrect.');
  if (next.length < 6) fail(400, 'New password must be at least 6 characters.');
  if (next === current) fail(400, 'New password must be different from the current one.');
  db.prepare('UPDATE users SET password_hash = ?, must_change = 0 WHERE id = ?').run(bcrypt.hashSync(next, 10), req.user.id);
  // sign out other devices
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token <> ?').run(req.user.id, req.tokenHash);
  res.json({ ok: true });
});

// ---------- self check-in / check-out ----------
function requireCodeIfNeeded(code) {
  if (getSetting('require_qr') !== '1') return code ? (isValidQrCode(code) ? 'qr' : fail(400, 'That code has expired. Scan the QR again.')) : 'app';
  if (!code) fail(400, 'Scan the QR code at the front desk (or type the 6-digit code shown under it).');
  if (!isValidQrCode(code)) fail(400, 'That code has expired or is wrong. Scan the QR again.');
  return 'qr';
}

app.post('/api/checkin', auth, (req, res) => {
  const method = requireCodeIfNeeded(req.body?.code);
  const { date, time } = now();
  const existing = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(req.user.id, date);
  if (existing?.check_in) fail(409, `You already checked in today at ${existing.check_in}.`);
  const status = time > getSetting('late_after') ? 'late' : 'present';
  db.prepare(`
    INSERT INTO attendance (user_id, date, status, check_in, method, marked_by)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (user_id, date) DO UPDATE SET
      status = CASE WHEN attendance.status IN ('present','late') THEN attendance.status ELSE excluded.status END,
      check_in = excluded.check_in, method = excluded.method, updated_at = CURRENT_TIMESTAMP`)
    .run(req.user.id, date, status, time, method, req.user.id);
  const record = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(req.user.id, date);
  res.json({ record, message: status === 'late' ? `Checked in at ${time12(time)} (late).` : `Checked in at ${time12(time)}. Have a good day!` });
});

app.post('/api/checkout', auth, (req, res) => {
  requireCodeIfNeeded(req.body?.code);
  const { date, time } = now();
  const existing = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(req.user.id, date);
  if (!existing?.check_in) fail(409, 'You have not checked in today.');
  if (existing.check_out) fail(409, `You already checked out at ${existing.check_out}.`);
  db.prepare('UPDATE attendance SET check_out = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(time, existing.id);
  const record = db.prepare('SELECT * FROM attendance WHERE id = ?').get(existing.id);
  res.json({ record, message: `Checked out at ${time12(time)}. See you tomorrow!` });
});

// ---------- summaries ----------
// "Working days" = days on which the institute recorded any attendance at all.
function summarize(users, from, to) {
  const days = db.prepare('SELECT DISTINCT date FROM attendance WHERE date BETWEEN ? AND ? ORDER BY date').all(from, to).map((r) => r.date);
  const byUser = new Map(users.map((u) => [u.id, new Map()]));
  if (users.length) {
    const rows = db.prepare(`SELECT a.user_id, a.date, a.status FROM attendance a JOIN users u ON u.id = a.user_id
                             WHERE a.date BETWEEN ? AND ?`).all(from, to);
    for (const r of rows) byUser.get(r.user_id)?.set(r.date, r.status);
  }
  return users.map((u) => {
    const start = u.join_date || (u.created_at || '').slice(0, 10) || from;
    const eligible = days.filter((d) => d >= start);
    const recs = byUser.get(u.id);
    const c = { present: 0, late: 0, absent: 0, leave: 0 };
    for (const d of eligible) {
      const s = recs.get(d);
      if (s) c[s]++;
    }
    const unmarked = eligible.length - c.present - c.late - c.absent - c.leave;
    const working = eligible.length;
    return {
      ...u,
      working_days: working,
      present: c.present, late: c.late, leave: c.leave,
      absent: c.absent + unmarked,
      percent: working ? Math.round(((c.present + c.late) / working) * 1000) / 10 : null,
    };
  });
}

app.get('/api/me/attendance', auth, (req, res) => {
  const { date: today } = now();
  const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : today.slice(0, 7);
  const from = `${month}-01`;
  const to = addDays(addDays(from, 31).slice(0, 7) + '-01', -1); // last day of the month
  const records = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date DESC').all(req.user.id, from, to);
  const [summary] = summarize([publicUser(req.user)], from, to < today ? to : today);
  res.json({ month, records, summary });
});

// ---------- batches ----------
const batchSelect = `
  SELECT b.*, t.name AS teacher_name,
    (SELECT COUNT(*) FROM users s WHERE s.batch_id = b.id AND s.active = 1 AND s.role = 'student') AS student_count
  FROM batches b LEFT JOIN users t ON t.id = b.teacher_id`;

app.get('/api/batches', auth, allow('admin', 'staff'), (req, res) => {
  const rows = req.user.role === 'admin'
    ? db.prepare(`${batchSelect} ORDER BY b.name`).all()
    : db.prepare(`${batchSelect} WHERE b.teacher_id = ? ORDER BY b.name`).all(req.user.id);
  res.json(rows);
});

function batchFields(b) {
  const name = str(b?.name, 100);
  if (!name) fail(400, 'Batch name is required.');
  const teacher_id = toInt(b?.teacher_id);
  if (Number.isNaN(teacher_id)) fail(400, 'Invalid teacher.');
  if (teacher_id && !db.prepare(`SELECT 1 FROM users WHERE id = ? AND role IN ('staff','admin')`).get(teacher_id)) fail(400, 'Teacher must be a staff member.');
  return { name, course: optStr(b?.course, 100), timing: optStr(b?.timing, 60), teacher_id };
}
app.post('/api/batches', auth, allow('admin'), (req, res) => {
  const f = batchFields(req.body);
  const r = db.prepare('INSERT INTO batches (name, course, timing, teacher_id) VALUES (?, ?, ?, ?)').run(f.name, f.course, f.timing, f.teacher_id);
  res.status(201).json(db.prepare(`${batchSelect} WHERE b.id = ?`).get(r.lastInsertRowid));
});
app.put('/api/batches/:id', auth, allow('admin'), (req, res) => {
  const f = batchFields(req.body);
  const r = db.prepare('UPDATE batches SET name = ?, course = ?, timing = ?, teacher_id = ? WHERE id = ?').run(f.name, f.course, f.timing, f.teacher_id, req.params.id);
  if (!r.changes) fail(404, 'Batch not found.');
  res.json(db.prepare(`${batchSelect} WHERE b.id = ?`).get(req.params.id));
});
app.delete('/api/batches/:id', auth, allow('admin'), (req, res) => {
  const r = db.prepare('DELETE FROM batches WHERE id = ?').run(req.params.id);
  if (!r.changes) fail(404, 'Batch not found.');
  res.json({ ok: true });
});

function loadBatchForRoll(req) {
  const batch = db.prepare(`${batchSelect} WHERE b.id = ?`).get(req.params.id);
  if (!batch) fail(404, 'Batch not found.');
  if (req.user.role !== 'admin' && batch.teacher_id !== req.user.id) fail(403, 'You can only take roll call for your own batches.');
  return batch;
}
function rollDate(req, raw) {
  const { date: today } = now();
  const date = raw ? checkDate(raw) : today;
  if (date > today) fail(400, 'You cannot mark attendance for a future date.');
  if (req.user.role !== 'admin' && date < addDays(today, -STAFF_ROLL_DAYS)) fail(403, `Teachers can only change the last ${STAFF_ROLL_DAYS} days. Ask the admin for older corrections.`);
  return date;
}

app.get('/api/batches/:id/roll', auth, allow('admin', 'staff'), (req, res) => {
  const batch = loadBatchForRoll(req);
  const date = req.query.date ? checkDate(req.query.date) : now().date;
  const students = db.prepare(`
    SELECT u.id, u.name, u.username, u.phone, a.status, a.check_in, a.check_out, a.method
    FROM users u LEFT JOIN attendance a ON a.user_id = u.id AND a.date = ?
    WHERE u.batch_id = ? AND u.role = 'student' AND u.active = 1
    ORDER BY u.name`).all(date, batch.id);
  res.json({ batch, date, students });
});

app.post('/api/batches/:id/roll', auth, allow('admin', 'staff'), (req, res) => {
  const batch = loadBatchForRoll(req);
  const date = rollDate(req, req.body?.date);
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : fail(400, 'No entries.');
  const allowed = new Set(db.prepare(`SELECT id FROM users WHERE batch_id = ? AND role = 'student'`).all(batch.id).map((r) => r.id));
  const upsert = db.prepare(`
    INSERT INTO attendance (user_id, date, status, method, marked_by) VALUES (?, ?, ?, 'roll', ?)
    ON CONFLICT (user_id, date) DO UPDATE SET status = excluded.status, marked_by = excluded.marked_by, updated_at = CURRENT_TIMESTAMP`);
  const clear = db.prepare('DELETE FROM attendance WHERE user_id = ? AND date = ?');
  let saved = 0;
  tx(() => {
    for (const e of entries) {
      const id = Number(e?.user_id);
      if (!allowed.has(id)) continue;
      if (e.status == null || e.status === '') clear.run(id, date);
      else if (STATUSES.includes(e.status)) upsert.run(id, date, e.status, req.user.id);
      else continue;
      saved++;
    }
  });
  res.json({ ok: true, saved });
});

// ---------- users (admin) ----------
const userSelect = `SELECT u.id, u.name, u.username, u.role, u.phone, u.designation, u.batch_id, u.join_date, u.active,
                           u.must_change, u.created_at, b.name AS batch_name
                    FROM users u LEFT JOIN batches b ON b.id = u.batch_id`;

app.get('/api/users', auth, allow('admin'), (req, res) => {
  const where = [], params = [];
  if (ROLES.includes(req.query.role)) { where.push('u.role = ?'); params.push(req.query.role); }
  if (req.query.role === 'teachers') where.push(`u.role IN ('staff','admin') AND u.active = 1`);
  if (req.query.q) { where.push('(u.name LIKE ? OR u.username LIKE ? OR u.phone LIKE ?)'); const q = `%${str(req.query.q, 60)}%`; params.push(q, q, q); }
  if (req.query.active === '1') where.push('u.active = 1');
  res.json(db.prepare(`${userSelect} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY u.active DESC, u.name`).all(...params));
});

function userFields(b) {
  const name = str(b?.name, 100);
  const username = str(b?.username, 60);
  const role = b?.role;
  if (!name) fail(400, 'Name is required.');
  if (!/^[A-Za-z0-9._@-]{3,60}$/.test(username)) fail(400, 'Username must be 3+ characters: letters, numbers, . _ - @ only.');
  if (!ROLES.includes(role)) fail(400, 'Choose a valid role.');
  let batch_id = role === 'student' ? toInt(b?.batch_id) : null;
  if (Number.isNaN(batch_id)) fail(400, 'Invalid batch.');
  if (batch_id && !db.prepare('SELECT 1 FROM batches WHERE id = ?').get(batch_id)) fail(400, 'Batch not found.');
  const join_date = b?.join_date ? checkDate(b.join_date, 'joining date') : null;
  return { name, username, role, batch_id, join_date, phone: optStr(b?.phone, 30), designation: optStr(b?.designation, 80) };
}
function uniqueGuard(fn) {
  try { return fn(); } catch (e) {
    if (/UNIQUE constraint failed: users.username/.test(e.message)) fail(409, 'That username is already taken.');
    throw e;
  }
}

app.post('/api/users', auth, allow('admin'), (req, res) => {
  const f = userFields(req.body);
  const password = String(req.body?.password ?? '');
  if (password.length < 6) fail(400, 'Password must be at least 6 characters.');
  const r = uniqueGuard(() => db.prepare(`
    INSERT INTO users (name, username, password_hash, role, phone, designation, batch_id, join_date, must_change)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`)
    .run(f.name, f.username, bcrypt.hashSync(password, 10), f.role, f.phone, f.designation, f.batch_id, f.join_date || now().date));
  res.status(201).json(db.prepare(`${userSelect} WHERE u.id = ?`).get(r.lastInsertRowid));
});

app.put('/api/users/:id', auth, allow('admin'), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!existing) fail(404, 'User not found.');
  const f = userFields(req.body);
  const active = req.body?.active === undefined ? existing.active : (req.body.active ? 1 : 0);
  if (id === req.user.id && (f.role !== 'admin' || !active)) fail(400, 'You cannot remove your own admin access or deactivate yourself.');
  tx(() => {
    uniqueGuard(() => db.prepare(`UPDATE users SET name = ?, username = ?, role = ?, phone = ?, designation = ?, batch_id = ?, join_date = ?, active = ? WHERE id = ?`)
      .run(f.name, f.username, f.role, f.phone, f.designation, f.batch_id, f.join_date, active, id));
    const password = String(req.body?.password ?? '');
    if (password) {
      if (password.length < 6) fail(400, 'Password must be at least 6 characters.');
      db.prepare('UPDATE users SET password_hash = ?, must_change = 1 WHERE id = ?').run(bcrypt.hashSync(password, 10), id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    }
    if (!active) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  });
  res.json(db.prepare(`${userSelect} WHERE u.id = ?`).get(id));
});

// ---------- daily register & manual marking (admin) ----------
app.get('/api/register', auth, allow('admin'), (req, res) => {
  const date = req.query.date ? checkDate(req.query.date) : now().date;
  const where = [`u.active = 1`, `u.role <> 'admin'`, `(u.join_date IS NULL OR u.join_date <= ?)`];
  const params = [date, date];
  if (ROLES.includes(req.query.role)) { where.push('u.role = ?'); params.push(req.query.role); }
  if (req.query.batch_id) { where.push('u.batch_id = ?'); params.push(Number(req.query.batch_id)); }
  const rows = db.prepare(`
    SELECT u.id, u.name, u.username, u.role, u.designation, u.batch_id, b.name AS batch_name,
           a.status, a.check_in, a.check_out, a.method, a.note, m.name AS marked_by_name
    FROM users u
    LEFT JOIN batches b ON b.id = u.batch_id
    LEFT JOIN attendance a ON a.user_id = u.id AND a.date = ?
    LEFT JOIN users m ON m.id = a.marked_by
    WHERE ${where.join(' AND ')}
    ORDER BY u.role, b.name, u.name`).all(...params);
  res.json({ date, rows });
});

app.post('/api/attendance', auth, allow('admin'), (req, res) => {
  const userId = Number(req.body?.user_id);
  if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(userId)) fail(404, 'User not found.');
  const date = checkDate(req.body?.date);
  if (date > now().date) fail(400, 'You cannot mark attendance for a future date.');
  const status = req.body?.status;
  if (!STATUSES.includes(status)) fail(400, 'Invalid status.');
  const ci = optStr(req.body?.check_in, 5), co = optStr(req.body?.check_out, 5);
  if ((ci && !TIME_RE.test(ci)) || (co && !TIME_RE.test(co))) fail(400, 'Times must be in HH:MM format.');
  if (ci && co && co < ci) fail(400, 'Check-out cannot be before check-in.');
  const keepTimes = req.body?.check_in === undefined && req.body?.check_out === undefined;
  db.prepare(`
    INSERT INTO attendance (user_id, date, status, check_in, check_out, method, marked_by, note)
    VALUES (?, ?, ?, ?, ?, 'manual', ?, ?)
    ON CONFLICT (user_id, date) DO UPDATE SET
      status = excluded.status,
      check_in = CASE WHEN ? THEN attendance.check_in ELSE excluded.check_in END,
      check_out = CASE WHEN ? THEN attendance.check_out ELSE excluded.check_out END,
      note = CASE WHEN ? THEN attendance.note ELSE excluded.note END,
      marked_by = excluded.marked_by, updated_at = CURRENT_TIMESTAMP`)
    .run(userId, date, status, ci, co, req.user.id, optStr(req.body?.note, 300), keepTimes ? 1 : 0, keepTimes ? 1 : 0, req.body?.note === undefined ? 1 : 0);
  res.json(db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(userId, date));
});

app.post('/api/attendance/mark-absent', auth, allow('admin'), (req, res) => {
  const date = checkDate(req.body?.date);
  if (date > now().date) fail(400, 'You cannot mark attendance for a future date.');
  const where = [`u.active = 1`, `u.role <> 'admin'`, `(u.join_date IS NULL OR u.join_date <= ?)`];
  const params = [date];
  if (ROLES.includes(req.body?.role)) { where.push('u.role = ?'); params.push(req.body.role); }
  if (req.body?.batch_id) { where.push('u.batch_id = ?'); params.push(Number(req.body.batch_id)); }
  const r = db.prepare(`
    INSERT INTO attendance (user_id, date, status, method, marked_by)
    SELECT u.id, ?, 'absent', 'manual', ? FROM users u
    WHERE ${where.join(' AND ')} AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.user_id = u.id AND a.date = ?)`)
    .run(date, req.user.id, ...params, date);
  res.json({ ok: true, marked: r.changes });
});

app.delete('/api/attendance', auth, allow('admin'), (req, res) => {
  const date = checkDate(req.query.date);
  db.prepare('DELETE FROM attendance WHERE user_id = ? AND date = ?').run(Number(req.query.user_id), date);
  res.json({ ok: true });
});

// ---------- dashboard & reports (admin) ----------
app.get('/api/dashboard', auth, allow('admin'), (req, res) => {
  const { date, time } = now();
  const byRole = db.prepare(`
    SELECT u.role, COUNT(*) AS total,
      SUM(a.status = 'present') AS present, SUM(a.status = 'late') AS late,
      SUM(a.status = 'leave') AS leave, SUM(a.status = 'absent') AS absent,
      SUM(a.status IS NULL) AS unmarked,
      SUM(a.check_in IS NOT NULL AND a.check_out IS NULL) AS inside
    FROM users u LEFT JOIN attendance a ON a.user_id = u.id AND a.date = ?
    WHERE u.active = 1 AND u.role <> 'admin' AND (u.join_date IS NULL OR u.join_date <= ?)
    GROUP BY u.role`).all(date, date);
  const recent = db.prepare(`
    SELECT u.name, u.role, a.status, a.check_in, a.check_out, a.method, a.updated_at
    FROM attendance a JOIN users u ON u.id = a.user_id
    WHERE a.date = ? AND a.check_in IS NOT NULL
    ORDER BY COALESCE(a.check_out, a.check_in) DESC LIMIT 12`).all(date);
  const from = addDays(date, -13);
  const trend = db.prepare(`
    SELECT date, SUM(status IN ('present','late')) AS attended, COUNT(*) AS marked
    FROM attendance WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date`).all(from, date);
  const lowAttendance = summarize(
    db.prepare(`SELECT id, name, role, join_date, created_at FROM users WHERE active = 1 AND role <> 'admin'`).all(),
    date.slice(0, 7) + '-01', date)
    .filter((u) => u.working_days >= 3 && u.percent !== null && u.percent < 75)
    .sort((a, b) => a.percent - b.percent).slice(0, 8);
  res.json({ date, time, byRole, recent, trend, lowAttendance });
});

function reportUsers(q) {
  const where = [`u.role <> 'admin'`], params = [];
  if (ROLES.includes(q.role)) { where.push('u.role = ?'); params.push(q.role); }
  if (q.batch_id) { where.push('u.batch_id = ?'); params.push(Number(q.batch_id)); }
  if (q.user_id) { where.push('u.id = ?'); params.push(Number(q.user_id)); }
  if (q.include_inactive !== '1') where.push('u.active = 1');
  return db.prepare(`SELECT u.id, u.name, u.username, u.role, u.designation, u.join_date, u.created_at, u.active, b.name AS batch_name
                     FROM users u LEFT JOIN batches b ON b.id = u.batch_id WHERE ${where.join(' AND ')} ORDER BY u.role, b.name, u.name`).all(...params);
}
function reportRange(q) {
  const { date: today } = now();
  const from = q.from ? checkDate(q.from, 'from date') : today.slice(0, 7) + '-01';
  let to = q.to ? checkDate(q.to, 'to date') : today;
  if (to > today) to = today;
  if (from > to) fail(400, '"From" date must be before "To" date.');
  return { from, to };
}

app.get('/api/reports/summary', auth, allow('admin'), (req, res) => {
  const { from, to } = reportRange(req.query);
  const rows = summarize(reportUsers(req.query), from, to).map(({ created_at, ...r }) => r);
  res.json({ from, to, rows });
});

const csvCell = (v) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // avoid spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (header, rows) => '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');

app.get('/api/reports/export', auth, allow('admin'), (req, res) => {
  const { from, to } = reportRange(req.query);
  const users = reportUsers(req.query);
  let csv;
  if (req.query.type === 'detail') {
    const ids = new Set(users.map((u) => u.id));
    const info = new Map(users.map((u) => [u.id, u]));
    const rows = db.prepare(`SELECT a.*, m.name AS marked_by_name FROM attendance a LEFT JOIN users m ON m.id = a.marked_by
                             WHERE a.date BETWEEN ? AND ? ORDER BY a.date, a.user_id`).all(from, to)
      .filter((r) => ids.has(r.user_id))
      .map((r) => { const u = info.get(r.user_id); return [r.date, u.name, u.username, u.role, u.batch_name || u.designation || '', r.status, r.check_in, r.check_out, r.method, r.marked_by_name, r.note]; });
    csv = toCsv(['Date', 'Name', 'Username', 'Role', 'Batch/Designation', 'Status', 'Check-in', 'Check-out', 'Method', 'Marked by', 'Note'], rows);
  } else {
    const rows = summarize(users, from, to).map((r) => [r.name, r.username, r.role, r.batch_name || r.designation || '', r.working_days, r.present, r.late, r.leave, r.absent, r.percent == null ? '' : r.percent + '%']);
    csv = toCsv(['Name', 'Username', 'Role', 'Batch/Designation', 'Working days', 'Present', 'Late', 'Leave', 'Absent', 'Attendance %'], rows);
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="attendance-${req.query.type === 'detail' ? 'detail' : 'summary'}-${from}-to-${to}.csv"`);
  res.send(csv);
});

// ---------- QR display ----------
app.get('/api/qr', auth, allow('admin'), async (req, res) => {
  res.json({ ...(await qrPayload(req)), kiosk_key: getSetting('kiosk_key') });
});
// Front-desk tablet/monitor: shows the QR without needing an admin login.
app.get('/api/kiosk/qr', async (req, res) => {
  const key = str(req.query.key, 100);
  const real = getSetting('kiosk_key');
  if (!key || key.length !== real.length || !crypto.timingSafeEqual(Buffer.from(key), Buffer.from(real))) fail(403, 'This kiosk link is no longer valid. Get a new link from Admin → Check-in QR.');
  res.json(await qrPayload(req));
});

// ---------- settings (admin) ----------
app.get('/api/settings', auth, allow('admin'), (req, res) => {
  res.json({
    institute_name: getSetting('institute_name'),
    timezone: getSetting('timezone'),
    late_after: getSetting('late_after'),
    require_qr: getSetting('require_qr') === '1',
  });
});
app.put('/api/settings', auth, allow('admin'), (req, res) => {
  const b = req.body || {};
  if (b.institute_name !== undefined) { const n = str(b.institute_name, 100); if (!n) fail(400, 'Institute name is required.'); setSetting('institute_name', n); }
  if (b.timezone !== undefined) {
    try { new Intl.DateTimeFormat('en', { timeZone: b.timezone }); } catch { fail(400, 'Unknown time zone. Example: Asia/Kolkata'); }
    setSetting('timezone', b.timezone);
  }
  if (b.late_after !== undefined) { if (!TIME_RE.test(b.late_after)) fail(400, 'Late-after time must be HH:MM.'); setSetting('late_after', b.late_after); }
  if (b.require_qr !== undefined) setSetting('require_qr', b.require_qr ? '1' : '0');
  if (b.regenerate_kiosk) setSetting('kiosk_key', crypto.randomBytes(16).toString('hex'));
  res.json({ ok: true });
});

// ---------- static files ----------
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.get('/vendor/jsQR.js', (req, res) => res.sendFile(require.resolve('jsqr/dist/jsQR.js')));
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, file) { if (/(sw\.js|index\.html)$/.test(file)) res.setHeader('Cache-Control', 'no-cache'); },
}));

app.use((err, req, res, next) => {
  const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server.' : err.message });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => console.log(`Infodesk Attendance running on http://localhost:${PORT}`));

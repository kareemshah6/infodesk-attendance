'use strict';
// Adds sample batches, people and 3 weeks of attendance so you can try the app.
// Usage: npm run seed-demo   (safe to run once on an empty database; do not run on real data)
const bcrypt = require('bcryptjs');
const { db, tx } = require('../db');

if (db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role <> 'admin'`).get().n > 0) {
  console.log('Database already has people in it - demo data not added.');
  process.exit(0);
}
const hash = bcrypt.hashSync('demo123', 10);
const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const rand = (a) => a[Math.floor(Math.random() * a.length)];
const time = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

tx(() => {
  const addUser = db.prepare(`INSERT INTO users (name, username, password_hash, role, phone, designation, batch_id, join_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const start = new Date(today); start.setDate(start.getDate() - 30);
  const joined = iso(start);

  const staff = [
    ['Priya Sharma', 'priya', 'Faculty - DCA'], ['Rahul Verma', 'rahul', 'Faculty - Tally'],
    ['Anita Desai', 'anita', 'Receptionist'], ['Imran Khan', 'imran', 'Lab Assistant'],
  ].map(([n, u, d], i) => Number(addUser.run(n, u, hash, 'staff', `98765000${10 + i}`, d, null, joined).lastInsertRowid));
  const partners = [['Suresh Patel', 'suresh', 'Managing Partner'], ['Kavita Rao', 'kavita', 'Branch Partner']]
    .map(([n, u, d], i) => Number(addUser.run(n, u, hash, 'partner', `98765000${20 + i}`, d, null, joined).lastInsertRowid));

  const addBatch = db.prepare('INSERT INTO batches (name, course, timing, teacher_id) VALUES (?, ?, ?, ?)');
  const batches = [
    ['DCA Morning', 'DCA', '9:00 - 11:00 AM', staff[0]], ['Tally Evening', 'Tally Prime + GST', '5:00 - 7:00 PM', staff[1]],
    ['ADCA Afternoon', 'ADCA', '2:00 - 4:00 PM', staff[0]],
  ].map((b) => Number(addBatch.run(...b).lastInsertRowid));

  const first = ['Aarav', 'Diya', 'Kabir', 'Meera', 'Rohan', 'Sana', 'Vikram', 'Neha', 'Arjun', 'Pooja', 'Farhan', 'Isha', 'Karan', 'Riya', 'Aditya', 'Zoya', 'Manish', 'Tanvi'];
  const last = ['Gupta', 'Singh', 'Yadav', 'Joshi', 'Mehta', 'Ali', 'Nair', 'Reddy', 'Das'];
  const students = first.map((n, i) => Number(addUser.run(`${n} ${last[i % last.length]}`, `stu${101 + i}`, hash, 'student', null, null, batches[i % 3], joined).lastInsertRowid));

  const addAtt = db.prepare(`INSERT INTO attendance (user_id, date, status, check_in, check_out, method, marked_by) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  for (let back = 21; back >= 1; back--) {
    const d = new Date(today); d.setDate(d.getDate() - back);
    if (d.getDay() === 0) continue; // Sunday off
    const date = iso(d);
    for (const id of [...staff, ...partners]) {
      const r = Math.random();
      if (r < 0.05) { addAtt.run(id, date, 'leave', null, null, 'manual', 1); continue; }
      if (r < 0.09) continue; // forgot / absent
      const late = r > 0.85;
      addAtt.run(id, date, late ? 'late' : 'present', time(late ? 10 : 9, late ? rand([0, 5, 20]) : rand([5, 15, 25, 35])), time(rand([17, 18]), rand([0, 15, 30])), 'qr', id);
    }
    students.forEach((id, i) => {
      const weak = i % 6 === 0; // a few students with low attendance
      const r = Math.random();
      const status = r < (weak ? 0.4 : 0.08) ? 'absent' : r < (weak ? 0.45 : 0.11) ? 'leave' : r > 0.93 ? 'late' : 'present';
      addAtt.run(id, date, status, null, null, 'roll', staff[0]);
    });
  }
});
console.log('Demo data added. Logins (password demo123): priya / rahul (teachers), anita, suresh (partner), stu101 (student).');

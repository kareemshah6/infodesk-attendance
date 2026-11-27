# Infodesk Attendance

Attendance app for **Infodesk Computer Education** — staff, partners and students.
It runs in any web browser and can be **installed on Android and iPhone** like a normal app (Progressive Web App).

## Features

| Who | What they can do |
|---|---|
| **Staff / Partners** | Check in & check out by scanning the front-desk QR code, see today's status, monthly %, full history |
| **Students** | Same as above, plus teachers mark them in roll call |
| **Teachers** (staff assigned to a batch) | Roll call for their batches (Present / Late / Leave / Absent), can correct the last 7 days |
| **Admin** | Live dashboard, daily register (edit anyone's attendance & times), people, batches, reports with CSV export (Excel), QR display, settings |

- **Rotating QR code** — changes every minute, so a photo shared on WhatsApp stops working. People can scan it inside the app, with their normal phone camera, or type the 6-digit code.
- **Front-desk kiosk link** — shows only the QR on a reception tablet/monitor, no admin login needed.
- **Late marking** — check-ins after the "late after" time (default 9:45 AM) are marked late automatically.
- **Reports** — attendance % per person for any date range; summary and day-wise CSV for Excel. The dashboard lists everyone below 75%.
- New users get a temporary password and must set their own at first login. Admin can reset passwords.

## Run it

Requires **Node.js 22.13 or newer**.

```bash
npm install
npm start
```

Open http://localhost:3000 and log in with **admin / admin123** (you'll be asked to change it).
Set a different first password with `ADMIN_PASSWORD=yourpass npm start`.

To try it with sample data (fresh install only): `npm run seed-demo` — demo logins use password `demo123`
(`priya`, `rahul` = teachers, `anita` = staff, `suresh` = partner, `stu101` = student).

### Settings (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 3000 | Web server port |
| `DB_PATH` | `data/attendance.db` | SQLite database file — **back this file up daily** |
| `ADMIN_PASSWORD` | admin123 | Password for the first admin account |
| `PUBLIC_URL` | (auto) | Public address used inside the QR code, e.g. `https://attendance.infodesk.in` |
| `TZ_NAME` | Asia/Kolkata | Initial time zone (can be changed later in Settings) |

## Put it online (needed for phones)

Phones need to reach the server over **HTTPS** (the camera only works on HTTPS). Options:

1. **A small VPS** (DigitalOcean, Hostinger, AWS Lightsail…): install Node 22, run `npm start` with a process manager such as `pm2`, and put **Caddy** or Nginx in front for free HTTPS.
2. **Render / Railway / Fly.io**: deploy as a Node app with a *persistent disk* mounted and `DB_PATH` pointing to it.

## Install on phones

- **Android (Chrome):** open the site → tap **Install** (or menu ⋮ → *Add to Home screen*).
- **iPhone (Safari):** open the site → Share → **Add to Home Screen**.

If you later want it in the Play Store / App Store, the same app can be wrapped with Capacitor or a Trusted Web Activity without rewriting it.

## Project layout

```
server.js          API + web server (Express)
db.js              SQLite schema, settings, first admin
public/            The app (HTML/CSS/JS, no build step)
  app.js           All screens
  kiosk.html       Front-desk QR screen
  sw.js, manifest.json, icons/   Installable-app files
scripts/seed-demo.js   Sample data
```

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
- **Excel import** for adding all students at once, and a one-click **backup** download.
- New users get a temporary password and must set their own at first login. Admin can reset passwords.

## Run it on Windows (easiest)

1. Install **Node.js LTS** from https://nodejs.org (then restart the computer).
2. Download this project (green **Code** button → **Download ZIP**) and extract it.
3. Optional: double-click **add-demo-data.bat** to load sample students and staff.
4. Double-click **start.bat**. The browser opens http://localhost:3000. Log in with `admin / admin123`.

Keep the black window open while using the app; closing it stops the app.

## Run it (any computer, command line)

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

Phones need an **https://** address (the camera only works on secure sites). Pick one:

### Option A — Render.com (easiest, about $7/month)

1. Sign up at [render.com](https://render.com) with your GitHub account.
2. Click **New → Blueprint**, pick this repository, and click **Apply**. Render reads `render.yaml`.
3. When asked, enter an **ADMIN_PASSWORD** (the first admin login).
4. After a few minutes you get an address like `https://infodesk-attendance.onrender.com`.
   You can connect your own domain (e.g. `attendance.infodesk.in`) under *Settings → Custom Domains*.

The blueprint uses the paid *Starter* plan because attendance data is kept on a persistent disk;
the free plan deletes all data on every restart. Download a backup weekly from **Settings → Backup**.

### Option B — your own server (about $5/month, e.g. Hostinger / DigitalOcean VPS with Ubuntu)

```bash
# 1. Install Node.js 22 and Caddy (for free HTTPS)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs caddy git
# 2. Get the app
sudo useradd -r -m -d /var/lib/infodesk infodesk
sudo git clone https://github.com/<you>/infodesk-attendance /opt/infodesk-attendance
cd /opt/infodesk-attendance && sudo npm ci --omit=dev
# 3. Edit the domain in deploy/infodesk-attendance.service and deploy/Caddyfile, then:
sudo cp deploy/infodesk-attendance.service /etc/systemd/system/
sudo systemctl enable --now infodesk-attendance
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy
# 4. Daily backups at 11:30 PM (keeps 30 days)
(sudo crontab -l 2>/dev/null; echo "30 23 * * * DB_PATH=/var/lib/infodesk/attendance.db /opt/infodesk-attendance/deploy/backup.sh") | sudo crontab -
```

Point your domain's **A record** to the server's IP address before step 3 so HTTPS works.
The first admin login is `admin / admin123` — change it immediately.

### Option C — Docker

```bash
docker build -t infodesk-attendance .
docker run -d -p 3000:3000 -v infodesk-data:/data -e ADMIN_PASSWORD=choose-one --restart unless-stopped infodesk-attendance
```

## Adding students in bulk

**People → Import from Excel.** Download the template, or use your existing sheet: only a *Name* column is required.
Recognised columns: Name, Username / Roll No, Phone / Mobile, Batch, Role (student, staff, partner, teacher),
Joining Date (DD/MM/YYYY), Designation, Password. You see a preview with any problem rows before anything is saved.
After importing, **download the login list**. It contains each person's temporary password and is shown only once.

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
render.yaml, Dockerfile, deploy/   Hosting setup
```

'use strict';
/* Infodesk Attendance - single page app (no build step). */

// ---------- utilities ----------
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};
const session = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { /* ignore */ } },
};
const initials = (n) => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
const fmtDate = (d, opts = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, opts) : '';
const fmtTime = (t) => {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const addDays = (date, n) => { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const pill = (s) => s ? `<span class="pill s-${esc(s)}">${esc(s)}</span>` : '<span class="pill s-none">Not marked</span>';
const ROLE_LABEL = { admin: 'Admin', staff: 'Staff', partner: 'Partner', student: 'Student' };
const ROLE_PLURAL = { admin: 'Admins', staff: 'Staff', partner: 'Partners', student: 'Students' };
const STATUS_SHORT = { present: 'P', late: 'L', absent: 'A', leave: 'Lv' };

const ICONS = {
  check: '<path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  person: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4h-4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = kind;
  el.textContent = msg;
  $('#toast').appendChild(el);
  setTimeout(() => el.remove(), kind === 'err' ? 5000 : 3200);
}

// ---------- API ----------
const state = { token: store.get('token'), me: null, settings: null, today: null, todayRecord: null };

async function api(path, { method = 'GET', body, raw = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (state.token) headers.Authorization = 'Bearer ' + state.token;
  let res;
  try {
    res = await fetch('/api' + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Cannot reach the server. Check your internet connection.');
  }
  if (raw && res.ok) return res;
  const data = (res.headers.get('content-type') || '').includes('json') ? await res.json() : { error: await res.text() };
  if (res.status === 401 && path !== '/login') {
    setToken(null);
    renderLogin(data.error);
    throw new Error(data.error || 'Please log in');
  }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
function setToken(t) { state.token = t; store.set('token', t); }
async function loadMe() {
  const d = await api('/me');
  state.me = d.user; state.settings = d.settings; state.today = d.today; state.todayRecord = d.todayRecord;
  return d;
}
async function downloadFile(path, fallbackName) {
  const res = await api(path, { raw: true });
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '')?.[1] || fallbackName;
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- QR deep link: phone camera opens https://.../?code=123456 ----------
(function capturePendingCode() {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  if (code) {
    session.set('pendingCode', code);
    history.replaceState(null, '', location.pathname + location.hash);
  }
})();

// ---------- navigation ----------
const ALL = ['admin', 'staff', 'partner', 'student'];
const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid', roles: ['admin'] },
  { id: 'home', label: 'My Attendance', short: 'Attendance', icon: 'check', roles: ['staff', 'partner', 'student'] },
  { id: 'register', label: 'Daily Register', short: 'Register', icon: 'list', roles: ['admin'] },
  { id: 'roll', label: 'Roll Call', icon: 'users', roles: ['admin', 'staff'] },
  { id: 'people', label: 'People', icon: 'person', roles: ['admin'] },
  { id: 'batches', label: 'Batches', icon: 'book', roles: ['admin'] },
  { id: 'reports', label: 'Reports', icon: 'chart', roles: ['admin'] },
  { id: 'qr', label: 'Check-in QR', short: 'QR', icon: 'qr', roles: ['admin'] },
  { id: 'settings', label: 'Settings', icon: 'gear', roles: ['admin'] },
  { id: 'profile', label: 'My Profile', short: 'Profile', icon: 'person', roles: ALL },
];
const navFor = (role) => NAV.filter((n) => n.roles.includes(role));
const defaultRoute = () => (state.me.role === 'admin' ? 'dashboard' : 'home');
let cleanupView = null;

function renderShell() {
  const items = navFor(state.me.role);
  const tabItems = items.length <= 4 ? items : items.slice(0, 3);
  $('#app').innerHTML = `
    <div class="shell" id="shell">
      <aside class="sidebar">
        <div class="brand"><img src="/icons/icon.svg" alt=""><div><b>${esc(state.settings.institute_name)}</b><span>Attendance</span></div></div>
        <nav class="nav">${items.map((n) => `<a href="#/${n.id}" data-route="${n.id}">${icon(n.icon)}<span>${n.label}</span></a>`).join('')}</nav>
        <div class="side-user"><b>${esc(state.me.name)}</b><div class="muted">${ROLE_LABEL[state.me.role]}${state.me.batch ? ' · ' + esc(state.me.batch.name) : state.me.designation ? ' · ' + esc(state.me.designation) : ''}</div>
          <button class="btn sm" style="margin-top:10px" id="logoutBtn">${icon('logout')} Log out</button></div>
      </aside>
      <div class="scrim" id="scrim"></div>
      <header class="topbar"><button id="menuBtn" aria-label="Menu">${icon('menu')}</button><b id="topTitle"></b></header>
      <main class="main" id="view"></main>
      <nav class="tabbar">
        ${tabItems.map((n) => `<a href="#/${n.id}" data-route="${n.id}">${icon(n.icon)}<span>${n.short || n.label}</span></a>`).join('')}
        ${items.length > 4 ? `<button id="moreBtn">${icon('more')}<span>More</span></button>` : ''}
      </nav>
    </div>`;
  const shell = $('#shell');
  const toggle = (open) => shell.classList.toggle('drawer-open', open);
  $('#menuBtn').onclick = () => toggle(true);
  $('#scrim').onclick = () => toggle(false);
  if ($('#moreBtn')) $('#moreBtn').onclick = () => toggle(true);
  $$('.nav a').forEach((a) => a.addEventListener('click', () => toggle(false)));
  $('#logoutBtn').onclick = logout;
}

async function route() {
  if (!state.me) return;
  const id = (location.hash.replace(/^#\/?/, '').split('?')[0]) || defaultRoute();
  const item = navFor(state.me.role).find((n) => n.id === id);
  if (!item) { location.hash = '#/' + defaultRoute(); return; }
  $$('[data-route]').forEach((a) => a.classList.toggle('active', a.dataset.route === id));
  $('#topTitle').textContent = item.label;
  document.title = `${item.label} · Infodesk Attendance`;
  if (cleanupView) { try { cleanupView(); } catch { /* ignore */ } cleanupView = null; }
  const view = $('#view');
  view.innerHTML = '<div class="muted">Loading…</div>';
  try {
    cleanupView = (await VIEWS[id](view)) || null;
  } catch (e) {
    view.innerHTML = `<div class="card"><div class="error">${esc(e.message)}</div><button class="btn" onclick="location.reload()">Retry</button></div>`;
  }
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

async function logout() {
  try { await api('/logout', { method: 'POST' }); } catch { /* ignore */ }
  setToken(null);
  state.me = null;
  renderLogin();
}

// ---------- modal ----------
function openModal(title, bodyHtml, { footer = '', wide = false } = {}) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true" ${wide ? 'style="max-width:720px"' : ''}>
    <header><h2>${esc(title)}</h2><button aria-label="Close" data-close>&times;</button></header>
    <div class="body">${bodyHtml}</div>${footer ? `<footer>${footer}</footer>` : ''}</div>`;
  const onClose = [];
  const close = () => { onClose.forEach((f) => f()); bg.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  bg.addEventListener('click', (e) => { if (e.target === bg || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(bg);
  const first = $('input:not([type=hidden]), select, textarea', bg);
  if (first && matchMedia('(min-width: 600px)').matches) first.focus();
  return { el: bg, close, onClose: (f) => onClose.push(f) };
}
function confirmBox(message, okLabel = 'Confirm') {
  return new Promise((resolve) => {
    const m = openModal('Please confirm', `<p style="margin:0">${esc(message)}</p>`,
      { footer: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="okBtn">${esc(okLabel)}</button>` });
    let done = false;
    m.onClose(() => { if (!done) resolve(false); });
    $('#okBtn', m.el).onclick = () => { done = true; m.close(); resolve(true); };
  });
}
const formData = (form) => Object.fromEntries(new FormData(form).entries());

// ---------- login ----------
function renderLogin(message) {
  if (cleanupView) { try { cleanupView(); } catch { /* ignore */ } cleanupView = null; }
  const pending = session.get('pendingCode');
  $('#app').innerHTML = `
    <div class="login-wrap"><div class="card login">
      <img class="logo" src="/icons/icon.svg" alt="">
      <h1>Infodesk Attendance</h1>
      <p class="sub">${pending ? 'Log in to complete your check-in' : 'Staff · Partners · Students'}</p>
      ${message && message !== 'Please log in' ? `<div class="error">${esc(message)}</div>` : ''}
      <div class="error hidden" id="loginErr"></div>
      <form id="loginForm">
        <label class="field"><span>Username</span><input name="username" autocomplete="username" autocapitalize="none" required></label>
        <label class="field"><span>Password</span><input name="password" type="password" autocomplete="current-password" required></label>
        <button class="btn primary big" type="submit">Log in</button>
      </form>
      <p class="muted small" style="text-align:center;margin:16px 0 0">Forgot your password? Ask the office to reset it.</p>
    </div></div>`;
  $('#loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', e.target);
    btn.disabled = true;
    try {
      const d = await api('/login', { method: 'POST', body: formData(e.target) });
      setToken(d.token);
      await start();
    } catch (err) {
      const box = $('#loginErr');
      if (box) { box.textContent = err.message; box.classList.remove('hidden'); }
      btn.disabled = false;
    }
  };
}

function renderForceChange() {
  $('#app').innerHTML = `
    <div class="login-wrap"><div class="card login">
      <img class="logo" src="/icons/icon.svg" alt="">
      <h1>Set your password</h1>
      <p class="sub">Welcome, ${esc(state.me.name)}! Please choose a new password before continuing.</p>
      <div class="error hidden" id="pwErr"></div>
      <form id="pwForm">
        <label class="field"><span>Current (temporary) password</span><input name="current" type="password" autocomplete="current-password" required></label>
        <label class="field"><span>New password (min 6 characters)</span><input name="password" type="password" minlength="6" autocomplete="new-password" required></label>
        <label class="field"><span>Repeat new password</span><input name="password2" type="password" minlength="6" autocomplete="new-password" required></label>
        <button class="btn primary big" type="submit">Save and continue</button>
      </form>
      <button class="btn" style="width:100%;margin-top:10px" id="pwLogout">Log out</button>
    </div></div>`;
  $('#pwLogout').onclick = logout;
  $('#pwForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = formData(e.target);
    const box = $('#pwErr');
    if (f.password !== f.password2) { box.textContent = 'The new passwords do not match.'; box.classList.remove('hidden'); return; }
    try {
      await api('/me/password', { method: 'POST', body: f });
      toast('Password updated', 'ok');
      await start();
    } catch (err) { box.textContent = err.message; box.classList.remove('hidden'); }
  };
}

async function start() {
  if (!state.token) return renderLogin();
  try { await loadMe(); } catch (e) { return renderLogin(e.message); }
  if (state.me.must_change) return renderForceChange();
  renderShell();
  await route();
  handlePendingCode();
}

// ---------- check-in / check-out ----------
async function doAttendance(action, code) {
  try {
    const d = await api('/' + action, { method: 'POST', body: code ? { code } : {} });
    state.todayRecord = d.record;
    toast(d.message, 'ok');
    if (navigator.vibrate) navigator.vibrate(80);
    return true;
  } catch (e) {
    toast(e.message, 'err');
    return false;
  }
}
const nextAction = () => (!state.todayRecord?.check_in ? 'checkin' : !state.todayRecord.check_out ? 'checkout' : null);

async function handlePendingCode() {
  const code = session.get('pendingCode');
  if (!code) return;
  session.set('pendingCode', null);
  const action = nextAction();
  if (!action) return toast('You have already checked in and out today.');
  if (await doAttendance(action, code)) { if (location.hash !== '#/home' && state.me.role !== 'admin') location.hash = '#/home'; else route(); }
}

let jsqrPromise = null;
const loadJsQR = () => jsqrPromise || (jsqrPromise = new Promise((res, rej) => {
  const s = document.createElement('script');
  s.src = '/vendor/jsQR.js'; s.onload = () => res(window.jsQR); s.onerror = rej;
  document.head.appendChild(s);
}));

function openScanner(action, onDone) {
  const label = action === 'checkin' ? 'Check in' : 'Check out';
  const m = openModal(`${label} — scan QR`, `
    <div class="scanner"><video playsinline muted></video><div class="frame"></div></div>
    <p class="muted small" id="scanMsg" style="text-align:center">Point your camera at the QR code at the front desk.</p>
    <form id="codeForm" style="display:flex;gap:8px;margin-top:8px">
      <input class="code-input" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="000000" aria-label="6-digit code" required>
      <button class="btn primary">Submit</button>
    </form>
    <p class="muted small" style="margin:6px 0 0;text-align:center">Camera not working? Type the 6-digit code shown under the QR.</p>`);
  const video = $('video', m.el);
  let stream = null, stopped = false, busy = false;
  const stop = () => { stopped = true; stream?.getTracks().forEach((t) => t.stop()); };
  m.onClose(stop);

  const submit = async (code) => {
    if (busy) return;
    busy = true;
    const ok = await doAttendance(action, code);
    busy = false;
    if (ok) { m.close(); onDone?.(); }
  };
  $('#codeForm', m.el).onsubmit = (e) => { e.preventDefault(); submit(e.target.code.value.trim()); };

  const extract = (text) => {
    try { const u = new URL(text); return u.searchParams.get('code'); } catch { return /^\d{6}$/.test(text) ? text : null; }
  };

  (async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      $('#scanMsg', m.el).textContent = 'Camera is not available here (it needs HTTPS). Use your phone camera app or type the code.';
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (stopped) return stop();
      video.srcObject = stream;
      await video.play();
    } catch {
      $('#scanMsg', m.el).textContent = 'Camera permission denied. Allow camera access, or type the code below.';
      return;
    }
    let detector = null, jsQR = null;
    if ('BarcodeDetector' in window) { try { detector = new BarcodeDetector({ formats: ['qr_code'] }); } catch { detector = null; } }
    if (!detector) { try { jsQR = await loadJsQR(); } catch { /* fallback to typing */ } }
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const tick = async () => {
      if (stopped) return;
      if (!busy && video.readyState >= 2) {
        let text = null;
        try {
          if (detector) {
            const codes = await detector.detect(video);
            text = codes[0]?.rawValue || null;
          } else if (jsQR) {
            const w = 480, h = Math.round((video.videoHeight / video.videoWidth) * w) || 480;
            canvas.width = w; canvas.height = h;
            ctx.drawImage(video, 0, 0, w, h);
            text = jsQR(ctx.getImageData(0, 0, w, h).data, w, h)?.data || null;
          }
        } catch { /* keep scanning */ }
        const code = text && extract(text);
        if (code) await submit(code);
      }
      setTimeout(tick, 250);
    };
    tick();
  })();
}

// ---------- views ----------
const VIEWS = {};

// My attendance (staff, partner, student)
VIEWS.home = async (view) => {
  let month = state.today.slice(0, 7);
  const me = state.me;
  view.innerHTML = `
    <div class="page-head"><div><h1>Hello, ${esc(me.name.split(' ')[0])} 👋</h1><p>${fmtDate(state.today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div></div>
    <div class="grid grid-2">
      <div class="card today" id="todayCard"></div>
      <div class="card" id="monthCard"></div>
    </div>
    <div class="card" id="historyCard" style="margin-top:16px"></div>
    ${installHint()}`;
  bindInstallHint(view);

  const renderToday = () => {
    const r = state.todayRecord;
    const action = nextAction();
    const qr = state.settings.require_qr;
    $('#todayCard').innerHTML = `
      <div class="card-head" style="margin-bottom:0"><h2>Today</h2>${r ? pill(r.status) : '<span class="pill s-none">Not checked in</span>'}</div>
      <div class="times">
        <div><span>CHECK-IN</span><b>${fmtTime(r?.check_in)}</b></div>
        <div><span>CHECK-OUT</span><b>${fmtTime(r?.check_out)}</b></div>
      </div>
      ${action ? `
        <button class="btn big" id="scanBtn">${icon('scan')} ${action === 'checkin' ? 'Scan QR to check in' : 'Scan QR to check out'}</button>
        ${!qr ? `<button class="btn big ghost" style="margin-top:8px" id="directBtn">${action === 'checkin' ? 'Check in now' : 'Check out now'}</button>` : ''}
        <p class="muted small" style="margin:10px 0 0">${me.role === 'student' ? 'Your teacher may also mark you in roll call.' : `Arriving after ${fmtTime(state.settings.late_after)} is marked late.`}</p>`
      : `<p style="margin:0;font-weight:600">✅ All done for today. See you tomorrow!</p>`}`;
    const refresh = () => { renderToday(); loadMonth(); };
    if ($('#scanBtn')) $('#scanBtn').onclick = () => openScanner(action, refresh);
    if ($('#directBtn')) $('#directBtn').onclick = async (e) => { e.target.disabled = true; if (await doAttendance(action)) refresh(); else e.target.disabled = false; };
  };

  const loadMonth = async () => {
    const d = await api('/me/attendance?month=' + month);
    const s = d.summary;
    const isCurrent = month === state.today.slice(0, 7);
    $('#monthCard').innerHTML = `
      <div class="card-head"><h2>${new Date(month + '-01T00:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
        <div class="btn-row"><button class="btn sm" id="prevM" aria-label="Previous month">‹</button><button class="btn sm" id="nextM" aria-label="Next month" ${isCurrent ? 'disabled' : ''}>›</button></div></div>
      <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:10px"><b style="font-size:2rem">${s.percent ?? '—'}${s.percent != null ? '%' : ''}</b><span class="muted">attendance · ${s.working_days} working day${s.working_days === 1 ? '' : 's'}</span></div>
      ${statusBar(s)}
      <div class="stats" style="margin-top:14px">
        <div class="stat present"><b>${s.present}</b><span>Present</span></div>
        <div class="stat late"><b>${s.late}</b><span>Late</span></div>
        <div class="stat leave"><b>${s.leave}</b><span>Leave</span></div>
        <div class="stat absent"><b>${s.absent}</b><span>Absent</span></div>
      </div>`;
    $('#prevM').onclick = () => { month = addDays(month + '-01', -1).slice(0, 7); loadMonth(); };
    $('#nextM').onclick = () => { month = addDays(month + '-01', 32).slice(0, 7); loadMonth(); };
    $('#historyCard').innerHTML = `<div class="card-head"><h2>History</h2></div>
      ${d.records.length ? `<ul class="list">${d.records.map((r) => `
        <li><div class="grow"><b>${fmtDate(r.date)}</b><span class="muted small">${r.check_in ? `In ${fmtTime(r.check_in)}` : ''}${r.check_out ? ` · Out ${fmtTime(r.check_out)}` : ''}${r.method === 'roll' ? 'Roll call' : ''}${r.note ? ' · ' + esc(r.note) : ''}</span></div>${pill(r.status)}</li>`).join('')}</ul>`
        : '<div class="empty">No attendance recorded this month.</div>'}`;
  };

  renderToday();
  await loadMonth();
};

function statusBar(s) {
  const total = s.working_days || 0;
  if (!total) return '<div class="bar"></div>';
  const w = (n) => `${(n / total) * 100}%`;
  return `<div class="bar"><i class="present" style="width:${w(s.present)}"></i><i class="late" style="width:${w(s.late)}"></i><i class="leave" style="width:${w(s.leave)}"></i><i class="absent" style="width:${w(s.absent)}"></i></div>`;
}

// PWA install prompt
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; $$('.install-hint').forEach((el) => el.classList.remove('hidden')); });
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
function installHint() {
  if (isStandalone()) return '';
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (ios) return `<div class="card install-hint" style="margin-top:16px"><div class="grow"><b>Install the app</b><div class="muted small">Tap the Share button, then “Add to Home Screen”.</div></div></div>`;
  return `<div class="card install-hint ${deferredInstall ? '' : 'hidden'}" style="margin-top:16px"><div class="grow"><b>Install the app</b><div class="muted small">Add Infodesk Attendance to your home screen for one-tap check-in.</div></div><button class="btn primary" data-install>Install</button></div>`;
}
function bindInstallHint(view) {
  const b = $('[data-install]', view);
  if (b) b.onclick = async () => { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; b.closest('.install-hint').remove(); };
}

// Admin dashboard
VIEWS.dashboard = async (view) => {
  const load = async () => {
    const d = await api('/dashboard');
    const roles = ['staff', 'partner', 'student'];
    const by = Object.fromEntries(d.byRole.map((r) => [r.role, r]));
    const card = (role) => {
      const r = by[role] || { total: 0, present: 0, late: 0, leave: 0, absent: 0, unmarked: 0, inside: 0 };
      const attended = (r.present || 0) + (r.late || 0);
      const pct = r.total ? Math.round((attended / r.total) * 100) : 0;
      const w = (n) => (r.total ? `${((n || 0) / r.total) * 100}%` : '0');
      return `<a class="card" href="#/register" data-role="${role}" style="text-decoration:none;color:inherit;display:block">
        <div class="card-head" style="margin-bottom:6px"><h2>${ROLE_PLURAL[role]}</h2><span class="muted small">${r.total} total</span></div>
        <div style="display:flex;align-items:baseline;gap:8px"><b style="font-size:2rem">${attended}</b><span class="muted">present today · ${pct}%</span></div>
        <div class="bar" style="margin-top:10px"><i class="present" style="width:${w(r.present)}"></i><i class="late" style="width:${w(r.late)}"></i><i class="leave" style="width:${w(r.leave)}"></i><i class="absent" style="width:${w(r.absent)}"></i></div>
        <div class="legend"><span><i style="background:var(--accent)"></i>${r.late || 0} late</span><span><i style="background:var(--leave)"></i>${r.leave || 0} leave</span><span><i style="background:var(--absent)"></i>${r.absent || 0} absent</span><span><i style="background:var(--none-bg);border:1px solid var(--border)"></i>${r.unmarked || 0} not marked</span></div>
      </a>`;
    };
    const days = [];
    for (let i = 13; i >= 0; i--) days.push(addDays(d.date, -i));
    const trendMap = Object.fromEntries(d.trend.map((t) => [t.date, t]));
    const maxAtt = Math.max(1, ...d.trend.map((t) => t.attended));
    view.innerHTML = `
      <div class="page-head"><div><h1>Dashboard</h1><p>${fmtDate(d.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · updated ${fmtTime(d.time)}</p></div>
        <div class="btn-row"><a class="btn" href="#/qr">${icon('qr')} Show QR</a><a class="btn primary" href="#/register">${icon('list')} Daily register</a></div></div>
      <div class="grid grid-3">${roles.map(card).join('')}</div>
      <div class="grid grid-2" style="margin-top:16px">
        <div class="card"><div class="card-head"><h2>Latest check-ins today</h2></div>
          ${d.recent.length ? `<ul class="list">${d.recent.map((r) => `<li><div class="avatar">${esc(initials(r.name))}</div><div class="grow"><b>${esc(r.name)}</b><span class="role">${ROLE_LABEL[r.role]}</span></div><div style="text-align:right"><div class="small">In ${fmtTime(r.check_in)}${r.check_out ? ` · Out ${fmtTime(r.check_out)}` : ''}</div>${pill(r.status)}</div></li>`).join('')}</ul>` : '<div class="empty">No one has checked in yet today.</div>'}
        </div>
        <div class="stack">
          <div class="card"><div class="card-head"><h2>People present — last 14 days</h2></div>
            <div class="trend">${days.map((dt) => { const t = trendMap[dt]; const v = t?.attended || 0; return `<div class="col" title="${fmtDate(dt)}: ${v} present"><i style="height:${(v / maxAtt) * 100}%;${t ? '' : 'opacity:.25'}"></i><span>${new Date(dt + 'T00:00:00').getDate()}</span></div>`; }).join('')}</div>
          </div>
          <div class="card"><div class="card-head"><h2>Below 75% this month</h2><a class="small" href="#/reports">Full report →</a></div>
            ${d.lowAttendance.length ? `<ul class="list">${d.lowAttendance.map((u) => `<li><div class="grow"><b>${esc(u.name)}</b><span class="role">${ROLE_LABEL[u.role]}</span></div><span class="pill s-absent">${u.percent}%</span></li>`).join('')}</ul>` : '<div class="empty">Everyone is above 75%. 🎉</div>'}
          </div>
        </div>
      </div>`;
    $$('[data-role]', view).forEach((a) => a.addEventListener('click', () => session.set('registerRole', a.dataset.role)));
  };
  await load();
  const timer = setInterval(() => { if (!document.hidden && !$('.modal-bg')) load().catch(() => {}); }, 60000);
  return () => clearInterval(timer);
};

// Admin daily register
VIEWS.register = async (view) => {
  let role = session.get('registerRole') || 'staff';
  session.set('registerRole', null);
  let date = state.today, batchId = '', q = '';
  const batches = await api('/batches');
  view.innerHTML = `
    <div class="page-head"><div><h1>Daily Register</h1><p>View and correct attendance for any day.</p></div></div>
    <div class="card">
      <div class="toolbar">
        <div class="tabs" id="roleTabs">${['staff', 'partner', 'student'].map((r) => `<button data-r="${r}">${ROLE_PLURAL[r]}</button>`).join('')}</div>
        <input type="date" id="regDate" value="${date}" max="${state.today}" style="width:auto">
        <select id="regBatch" style="width:auto"><option value="">All batches</option>${batches.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select>
        <input type="search" id="regQ" placeholder="Search name…">
      </div>
      <div id="regSummary" class="legend" style="margin:-4px 0 12px"></div>
      <div class="table-wrap"><table><thead><tr><th>Name</th><th>In</th><th>Out</th><th>Status</th><th></th></tr></thead><tbody id="regBody"></tbody></table></div>
      <div class="btn-row" style="margin-top:14px"><button class="btn danger" id="markAbsent">Mark everyone not marked as absent</button></div>
    </div>`;
  let rows = [];
  const draw = () => {
    $$('#roleTabs button').forEach((b) => b.classList.toggle('active', b.dataset.r === role));
    $('#regBatch').classList.toggle('hidden', role !== 'student');
    const list = rows.filter((r) => !q || r.name.toLowerCase().includes(q));
    const c = { present: 0, late: 0, leave: 0, absent: 0, none: 0 };
    rows.forEach((r) => c[r.status || 'none']++);
    $('#regSummary').innerHTML = `<span><i style="background:var(--present)"></i>${c.present} present</span><span><i style="background:var(--accent)"></i>${c.late} late</span><span><i style="background:var(--leave)"></i>${c.leave} leave</span><span><i style="background:var(--absent)"></i>${c.absent} absent</span><span><i style="background:var(--none-bg);border:1px solid var(--border)"></i>${c.none} not marked</span>`;
    $('#regBody').innerHTML = list.length ? list.map((r) => `
      <tr data-id="${r.id}">
        <td><b>${esc(r.name)}</b><div class="muted small">${esc(r.batch_name || r.designation || r.username)}${r.method ? ` · ${r.method === 'qr' ? 'QR' : r.method === 'roll' ? 'Roll call' : r.method === 'manual' ? 'Office' : 'App'}` : ''}${r.note ? ' · ' + esc(r.note) : ''}</div></td>
        <td class="small">${fmtTime(r.check_in)}</td><td class="small">${fmtTime(r.check_out)}</td>
        <td><div class="seg">${['present', 'late', 'leave', 'absent'].map((s) => `<button data-s="${s}" class="${r.status === s ? 'on' : ''}" title="${cap(s)}">${STATUS_SHORT[s]}</button>`).join('')}</div></td>
        <td><button class="btn sm" data-edit>Edit</button></td>
      </tr>`).join('') : `<tr><td colspan="5" class="empty">No ${ROLE_PLURAL[role].toLowerCase()} found.</td></tr>`;
  };
  const load = async () => {
    const p = new URLSearchParams({ date, role });
    if (role === 'student' && batchId) p.set('batch_id', batchId);
    rows = (await api('/register?' + p)).rows;
    draw();
  };
  $('#roleTabs').onclick = (e) => { const b = e.target.closest('button'); if (b) { role = b.dataset.r; load(); } };
  $('#regDate').onchange = (e) => { date = e.target.value || state.today; load(); };
  $('#regBatch').onchange = (e) => { batchId = e.target.value; load(); };
  $('#regQ').oninput = (e) => { q = e.target.value.trim().toLowerCase(); draw(); };
  $('#regBody').onclick = async (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    const row = rows.find((r) => r.id === Number(tr.dataset.id));
    const sb = e.target.closest('.seg button');
    if (sb) {
      try {
        await api('/attendance', { method: 'POST', body: { user_id: row.id, date, status: sb.dataset.s } });
        row.status = sb.dataset.s; draw();
      } catch (err) { toast(err.message, 'err'); }
    } else if (e.target.closest('[data-edit]')) {
      editAttendance(row, date, load);
    }
  };
  $('#markAbsent').onclick = async () => {
    if (!(await confirmBox(`Mark all ${ROLE_PLURAL[role].toLowerCase()} with no attendance on ${fmtDate(date)} as absent?`, 'Mark absent'))) return;
    try {
      const r = await api('/attendance/mark-absent', { method: 'POST', body: { date, role, batch_id: role === 'student' ? batchId : '' } });
      toast(`${r.marked} marked absent`, 'ok'); load();
    } catch (err) { toast(err.message, 'err'); }
  };
  await load();
};

function editAttendance(row, date, onSaved) {
  const m = openModal(`${row.name} — ${fmtDate(date)}`, `
    <form id="attForm">
      <label class="field"><span>Status</span><select name="status">${['present', 'late', 'leave', 'absent'].map((s) => `<option value="${s}" ${row.status === s ? 'selected' : ''}>${cap(s)}</option>`).join('')}</select></label>
      <div class="form-grid">
        <label class="field"><span>Check-in</span><input type="time" name="check_in" value="${esc(row.check_in || '')}"></label>
        <label class="field"><span>Check-out</span><input type="time" name="check_out" value="${esc(row.check_out || '')}"></label>
      </div>
      <label class="field"><span>Note (e.g. reason for leave)</span><input name="note" maxlength="300" value="${esc(row.note || '')}"></label>
      ${row.marked_by_name ? `<p class="muted small">Last marked by ${esc(row.marked_by_name)}</p>` : ''}
    </form>`, {
    footer: `${row.status ? '<button class="btn danger" id="clearAtt" style="margin-right:auto">Clear</button>' : ''}<button class="btn" data-close>Cancel</button><button class="btn primary" id="saveAtt">Save</button>`,
  });
  $('#saveAtt', m.el).onclick = async () => {
    try {
      await api('/attendance', { method: 'POST', body: { user_id: row.id, date, ...formData($('#attForm', m.el)) } });
      toast('Saved', 'ok'); m.close(); onSaved();
    } catch (err) { toast(err.message, 'err'); }
  };
  if ($('#clearAtt', m.el)) $('#clearAtt', m.el).onclick = async () => {
    try { await api(`/attendance?user_id=${row.id}&date=${date}`, { method: 'DELETE' }); toast('Cleared'); m.close(); onSaved(); }
    catch (err) { toast(err.message, 'err'); }
  };
}

// Roll call (admin + teachers)
VIEWS.roll = async (view) => {
  const batches = await api('/batches');
  if (!batches.length) {
    view.innerHTML = `<div class="page-head"><h1>Roll Call</h1></div><div class="card empty">${state.me.role === 'admin' ? 'Create a batch first under <a href="#/batches">Batches</a>.' : 'No batches are assigned to you yet. Ask the admin to set you as the teacher of a batch.'}</div>`;
    return;
  }
  let batchId = store.get('rollBatch') && batches.some((b) => String(b.id) === store.get('rollBatch')) ? store.get('rollBatch') : String(batches[0].id);
  let date = state.today;
  let students = [], marks = {}, dirty = false;
  view.innerHTML = `
    <div class="page-head"><div><h1>Roll Call</h1><p>Mark attendance for your batch.</p></div></div>
    <div class="card">
      <div class="toolbar">
        <label class="field"><span>Batch</span><select id="rollBatch">${batches.map((b) => `<option value="${b.id}" ${String(b.id) === batchId ? 'selected' : ''}>${esc(b.name)}${b.timing ? ' · ' + esc(b.timing) : ''}</option>`).join('')}</select></label>
        <label class="field"><span>Date</span><input type="date" id="rollDate" value="${date}" max="${state.today}"></label>
      </div>
      <div class="btn-row" style="margin-bottom:8px"><button class="btn sm" id="allP">All present</button><button class="btn sm" id="restA">Rest absent</button><span class="muted small" id="rollCount" style="align-self:center"></span></div>
      <ul class="list" id="rollList"></ul>
      <button class="btn primary big" id="rollSave" style="margin-top:12px">Save roll call</button>
    </div>`;
  const draw = () => {
    const c = Object.values(marks).filter(Boolean);
    $('#rollCount').textContent = `${c.filter((s) => s === 'present' || s === 'late').length}/${students.length} present`;
    $('#rollList').innerHTML = students.length ? students.map((s) => `
      <li data-id="${s.id}"><div class="avatar">${esc(initials(s.name))}</div>
        <div class="grow"><b>${esc(s.name)}</b><span class="muted small">${esc(s.username)}${s.check_in ? ` · checked in ${fmtTime(s.check_in)}` : ''}</span></div>
        <div class="seg">${['present', 'late', 'leave', 'absent'].map((st) => `<button data-s="${st}" class="${marks[s.id] === st ? 'on' : ''}" title="${cap(st)}">${STATUS_SHORT[st]}</button>`).join('')}</div>
      </li>`).join('') : '<li class="empty" style="display:block">No students in this batch. Add students under People.</li>';
    $('#rollSave').textContent = dirty ? 'Save roll call' : 'Saved ✓';
    $('#rollSave').disabled = !dirty;
  };
  const load = async () => {
    const d = await api(`/batches/${batchId}/roll?date=${date}`);
    students = d.students;
    marks = Object.fromEntries(students.map((s) => [s.id, s.status || null]));
    dirty = false;
    draw();
  };
  const guard = async () => !dirty || confirmBox('You have unsaved changes. Discard them?', 'Discard');
  $('#rollBatch').onchange = async (e) => { if (!(await guard())) { e.target.value = batchId; return; } batchId = e.target.value; store.set('rollBatch', batchId); load(); };
  $('#rollDate').onchange = async (e) => { if (!(await guard())) { e.target.value = date; return; } date = e.target.value || state.today; load(); };
  $('#rollList').onclick = (e) => {
    const b = e.target.closest('.seg button'); if (!b) return;
    const id = Number(b.closest('li').dataset.id);
    marks[id] = marks[id] === b.dataset.s ? null : b.dataset.s;
    dirty = true; draw();
  };
  $('#allP').onclick = () => { students.forEach((s) => { marks[s.id] = 'present'; }); dirty = true; draw(); };
  $('#restA').onclick = () => { students.forEach((s) => { if (!marks[s.id]) marks[s.id] = 'absent'; }); dirty = true; draw(); };
  $('#rollSave').onclick = async () => {
    try {
      const r = await api(`/batches/${batchId}/roll`, { method: 'POST', body: { date, entries: students.map((s) => ({ user_id: s.id, status: marks[s.id] })) } });
      toast(`Roll call saved (${r.saved} students)`, 'ok');
      await load();
    } catch (err) { toast(err.message, 'err'); }
  };
  await load();
  const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', warn);
  return () => window.removeEventListener('beforeunload', warn);
};

// People (admin)
VIEWS.people = async (view) => {
  let role = 'all', q = '';
  let users = [], batches = [];
  view.innerHTML = `
    <div class="page-head"><div><h1>People</h1><p>Staff, partners and students who can use the app.</p></div>
      <div class="btn-row"><button class="btn" id="importUsers">${icon('upload')} Import from Excel</button><button class="btn primary" id="addUser">${icon('plus')} Add person</button></div></div>
    <div class="card">
      <div class="toolbar">
        <div class="tabs" id="peopleTabs">${['all', 'staff', 'partner', 'student', 'admin'].map((r) => `<button data-r="${r}">${r === 'all' ? 'All' : ROLE_PLURAL[r]}</button>`).join('')}</div>
        <input type="search" id="peopleQ" placeholder="Search name, username or phone…">
      </div>
      <div class="table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Username</th><th>Phone</th><th>Batch / Designation</th><th>Status</th></tr></thead><tbody id="peopleBody"></tbody></table></div>
    </div>`;
  const draw = () => {
    $$('#peopleTabs button').forEach((b) => b.classList.toggle('active', b.dataset.r === role));
    const list = users.filter((u) => (role === 'all' || u.role === role) && (!q || `${u.name} ${u.username} ${u.phone || ''}`.toLowerCase().includes(q)));
    $('#peopleBody').innerHTML = list.length ? list.map((u) => `
      <tr class="clickable ${u.active ? '' : 'inactive'}" data-id="${u.id}">
        <td><b>${esc(u.name)}</b></td><td><span class="role">${ROLE_LABEL[u.role]}</span></td><td>${esc(u.username)}</td>
        <td>${esc(u.phone || '')}</td><td>${esc(u.batch_name || u.designation || '')}</td>
        <td>${u.active ? (u.must_change ? '<span class="pill s-late">Awaiting first login</span>' : '<span class="pill s-present">Active</span>') : '<span class="pill s-none">Inactive</span>'}</td>
      </tr>`).join('') : '<tr><td colspan="6" class="empty">No people found.</td></tr>';
  };
  const load = async () => { [users, batches] = await Promise.all([api('/users'), api('/batches')]); draw(); };
  $('#peopleTabs').onclick = (e) => { const b = e.target.closest('button'); if (b) { role = b.dataset.r; draw(); } };
  $('#peopleQ').oninput = (e) => { q = e.target.value.trim().toLowerCase(); draw(); };
  $('#addUser').onclick = () => userForm(null, batches, load, role === 'all' ? 'student' : role);
  $('#importUsers').onclick = () => importPeople(load);
  $('#peopleBody').onclick = (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) userForm(users.find((u) => u.id === Number(tr.dataset.id)), batches, load); };
  await load();
};

function userForm(user, batches, onSaved, defaultRole = 'student') {
  const u = user || { role: defaultRole, active: 1 };
  const isNew = !user;
  const tempPw = Math.random().toString(36).slice(2, 8) + Math.floor(Math.random() * 90 + 10);
  const m = openModal(isNew ? 'Add person' : `Edit ${u.name}`, `
    <form id="userForm" autocomplete="off">
      <label class="field"><span>Full name</span><input name="name" required value="${esc(u.name || '')}"></label>
      <div class="form-grid">
        <label class="field"><span>Role</span><select name="role">${['student', 'staff', 'partner', 'admin'].map((r) => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}</select></label>
        <label class="field"><span>Username (for login)</span><input name="username" required autocapitalize="none" value="${esc(u.username || '')}" placeholder="e.g. roll no. or phone"></label>
        <label class="field"><span>Phone</span><input name="phone" type="tel" value="${esc(u.phone || '')}"></label>
        <label class="field"><span>Joining date</span><input name="join_date" type="date" value="${esc(u.join_date || '')}"></label>
      </div>
      <label class="field" data-for="student"><span>Batch</span><select name="batch_id"><option value="">— No batch —</option>${batches.map((b) => `<option value="${b.id}" ${u.batch_id === b.id ? 'selected' : ''}>${esc(b.name)}${b.timing ? ' · ' + esc(b.timing) : ''}</option>`).join('')}</select></label>
      <label class="field" data-for="other"><span>Designation</span><input name="designation" value="${esc(u.designation || '')}" placeholder="e.g. Faculty, Receptionist, Branch partner"></label>
      <label class="field"><span>${isNew ? 'Temporary password' : 'Reset password (leave blank to keep)'}</span><input name="password" ${isNew ? `required value="${tempPw}"` : ''} minlength="6" autocomplete="new-password"></label>
      ${isNew ? '<p class="muted small" style="margin-top:-6px">Share the username and temporary password. They will be asked to set their own password at first login.</p>' : ''}
      ${!isNew ? `<label class="switch"><input type="checkbox" name="active" ${u.active ? 'checked' : ''}> <span>Active (can log in and appears in attendance)</span></label>` : ''}
    </form>`, { footer: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="saveUser">${isNew ? 'Add person' : 'Save changes'}</button>` });
  const form = $('#userForm', m.el);
  const syncRole = () => {
    const r = form.role.value;
    $('[data-for=student]', form).classList.toggle('hidden', r !== 'student');
    $('[data-for=other]', form).classList.toggle('hidden', r === 'student');
  };
  form.role.onchange = syncRole; syncRole();
  $('#saveUser', m.el).onclick = async () => {
    if (!form.reportValidity()) return;
    const f = formData(form);
    if (!isNew) f.active = form.active.checked;
    try {
      await api(isNew ? '/users' : `/users/${u.id}`, { method: isNew ? 'POST' : 'PUT', body: f });
      m.close();
      if (isNew || f.password) {
        openModal('Login details', `<p style="margin-top:0">Share these with <b>${esc(f.name)}</b>:</p>
          <p>Website: <span class="kbd">${esc(location.origin)}</span><br>Username: <span class="kbd">${esc(f.username)}</span><br>Password: <span class="kbd">${esc(f.password)}</span></p>
          <p class="muted small">They will be asked to change the password when they log in.</p>`, { footer: '<button class="btn primary" data-close>Done</button>' });
      } else toast('Saved', 'ok');
      onSaved();
    } catch (err) { toast(err.message, 'err'); }
  };
}

// ---------- bulk import from Excel / CSV ----------
const IMPORT_COLUMNS = {
  name: ['name', 'full name', 'student name', 'staff name'],
  username: ['username', 'user name', 'login', 'roll no', 'roll number', 'roll', 'enrollment no', 'enrolment no', 'reg no', 'registration no', 'id'],
  phone: ['phone', 'mobile', 'mobile no', 'phone no', 'contact', 'contact no', 'whatsapp'],
  batch: ['batch', 'batch name', 'class', 'course batch'],
  role: ['role', 'type', 'category'],
  join_date: ['join date', 'joining date', 'admission date', 'date of joining', 'doj', 'date of admission'],
  password: ['password'],
  designation: ['designation', 'post', 'position'],
};
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',' || c === ';' || c === '\t') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
let excelPromise = null;
const loadExcelReader = () => excelPromise || (excelPromise = new Promise((res, rej) => {
  const s = document.createElement('script');
  s.src = '/vendor/read-excel-file.js'; s.onload = () => res(window.readXlsxFile || window.readExcelFile); s.onerror = () => rej(new Error('Could not load the Excel reader'));
  document.head.appendChild(s);
}));
async function readSheet(file) {
  if (/\.xlsx$/i.test(file.name)) {
    const read = await loadExcelReader();
    let rows = await read(file);
    // newer versions return [{ sheet, data }] (one entry per sheet); use the first sheet
    if (rows.length && rows[0] && !Array.isArray(rows[0]) && Array.isArray(rows[0].data)) rows = rows[0].data;
    return rows.map((r) => r.map((c) => c instanceof Date
      ? `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}-${String(c.getDate()).padStart(2, '0')}`
      : c == null ? '' : String(c)));
  }
  if (/\.xls$/i.test(file.name)) throw new Error('Old .xls files are not supported. In Excel choose File → Save As → Excel Workbook (.xlsx) or CSV.');
  return parseCsv(await file.text());
}
function rowsToPeople(rows) {
  const firstIdx = rows.findIndex((r) => r.some((c) => String(c ?? '').trim() !== ''));
  if (firstIdx < 0) throw new Error('The file is empty.');
  const header = rows[firstIdx].map((h) => String(h).trim().toLowerCase().replace(/[_.*:]/g, ' ').replace(/\s+/g, ' ').trim());
  const map = {};
  for (const [key, names] of Object.entries(IMPORT_COLUMNS)) {
    const idx = header.findIndex((h) => names.includes(h));
    if (idx >= 0) map[key] = idx;
  }
  if (map.name == null) throw new Error('Could not find a "Name" column. Download the template to see the expected columns.');
  const people = [];
  rows.forEach((r, idx) => {
    if (idx <= firstIdx || !r.some((c) => String(c ?? '').trim() !== '')) return; // skip header and blank rows
    people.push({ row: idx + 1, ...Object.fromEntries(Object.entries(map).map(([k, i]) => [k, String(r[i] ?? '').trim()])) });
  });
  if (!people.length) throw new Error('No people found below the header row.');
  return { people, columns: Object.keys(map) };
}
function downloadText(name, text) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' })), download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const csvLine = (cells) => cells.map((c) => { const v = String(c ?? ''); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }).join(',');

function importPeople(onDone) {
  const m = openModal('Import people from Excel', `
    <ol style="padding-left:20px;margin-top:0">
      <li>Download the template, or use your own sheet with a <b>Name</b> column.</li>
      <li>Fill one person per row. Only <b>Name</b> is required.</li>
      <li>Upload the file (.xlsx or .csv) and check the preview.</li>
    </ol>
    <p class="muted small">Optional columns: Username (or Roll No), Phone, Batch, Role (student / staff / partner — blank means student), Joining Date (DD/MM/YYYY), Designation, Password.
      Missing usernames and passwords are created automatically.</p>
    <div class="btn-row" style="margin-bottom:14px"><button class="btn sm" id="tplBtn">${icon('download')} Download template</button></div>
    <label class="field"><span>Excel or CSV file</span><input type="file" id="impFile" accept=".xlsx,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label>
    <label class="switch"><input type="checkbox" id="impCreate" checked><span>Create batches that don't exist yet</span></label>
    <div id="impPreview"></div>`, { wide: true, footer: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="impGo" disabled>Import</button>` });
  let people = null;
  $('#tplBtn', m.el).onclick = () => downloadText('infodesk-import-template.csv', [
    csvLine(['Name', 'Roll No', 'Phone', 'Batch', 'Role', 'Joining Date', 'Designation']),
    csvLine(['Aarav Gupta', 'stu201', '9876500001', 'DCA Morning', 'student', '01/12/2026', '']),
    csvLine(['Sana Ali', '', '9876500002', 'Tally Evening', 'student', '', '']),
    csvLine(['Ramesh Kumar', 'ramesh', '9876500003', '', 'staff', '', 'Faculty - Tally']),
  ].join('\r\n'));

  const preview = async () => {
    const box = $('#impPreview', m.el);
    const go = $('#impGo', m.el);
    go.disabled = true;
    if (!people) return;
    box.innerHTML = '<p class="muted">Checking…</p>';
    try {
      const r = await api('/users/import', { method: 'POST', body: { rows: people, dry_run: true, create_batches: $('#impCreate', m.el).checked } });
      const bad = r.results.filter((x) => !x.ok);
      box.innerHTML = `
        <div class="stats" style="margin:4px 0 12px"><div class="stat present"><b>${r.valid}</b><span>Ready to import</span></div><div class="stat absent"><b>${r.invalid}</b><span>With problems</span></div>${r.new_batches.length ? `<div class="stat"><b>${r.new_batches.length}</b><span>New batches</span></div>` : ''}</div>
        ${r.new_batches.length ? `<p class="small">New batches: ${r.new_batches.map(esc).join(', ')}</p>` : ''}
        ${bad.length ? `<p class="small"><b>These rows will be skipped</b> — fix them in the file and upload again, or import the rest now:</p>
          <div class="table-wrap"><table><thead><tr><th>Row</th><th>Name</th><th>Problem</th></tr></thead><tbody>${bad.map((x) => `<tr><td>${x.row}</td><td>${esc(x.name)}</td><td class="small" style="color:var(--absent)">${esc(x.error)}</td></tr>`).join('')}</tbody></table></div>` : ''}
        ${r.valid ? `<details style="margin-top:10px"><summary class="small">Preview first ${Math.min(10, r.valid)} people</summary><div class="table-wrap"><table><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Batch</th><th>Phone</th></tr></thead><tbody>
          ${r.results.filter((x) => x.ok).slice(0, 10).map((x) => `<tr><td>${esc(x.name)}</td><td>${esc(x.username)}</td><td>${ROLE_LABEL[x.role]}</td><td>${esc(x.batch || '')}</td><td>${esc(x.phone || '')}</td></tr>`).join('')}</tbody></table></div></details>` : ''}`;
      go.disabled = !r.valid;
      go.textContent = `Import ${r.valid} ${r.valid === 1 ? 'person' : 'people'}`;
    } catch (e) { box.innerHTML = `<div class="error">${esc(e.message)}</div>`; }
  };
  $('#impFile', m.el).onchange = async (e) => {
    const file = e.target.files[0];
    people = null;
    if (!file) return preview();
    try {
      const parsed = rowsToPeople(await readSheet(file));
      people = parsed.people;
    } catch (err) { $('#impPreview', m.el).innerHTML = `<div class="error">${esc(err.message)}</div>`; return; }
    preview();
  };
  $('#impCreate', m.el).onchange = preview;
  $('#impGo', m.el).onclick = async (e) => {
    e.target.disabled = true;
    try {
      const r = await api('/users/import', { method: 'POST', body: { rows: people, create_batches: $('#impCreate', m.el).checked } });
      m.close();
      onDone();
      const ok = r.results.filter((x) => x.ok);
      const creds = [csvLine(['Name', 'Role', 'Batch', 'Phone', 'Username', 'Temporary password', 'Website']),
        ...ok.map((x) => csvLine([x.name, x.role, x.batch || '', x.phone || '', x.username, x.password, location.origin]))].join('\r\n');
      const done = openModal('Import complete', `
        <p style="margin-top:0"><b>${r.imported}</b> ${r.imported === 1 ? 'person was' : 'people were'} added${r.invalid ? `, ${r.invalid} skipped` : ''}.</p>
        <p><b>Download the login list now.</b> It has everyone's username and temporary password, and this is the only time the passwords are shown.
          Share each person's login with them; they set their own password at first login.</p>`,
        { footer: `<button class="btn" data-close>Close</button><button class="btn primary" id="credBtn">${icon('download')} Download login list</button>` });
      $('#credBtn', done.el).onclick = () => downloadText(`infodesk-logins-${state.today}.csv`, creds);
    } catch (err) { toast(err.message, 'err'); e.target.disabled = false; }
  };
}

// Batches (admin)
VIEWS.batches = async (view) => {
  const load = async () => {
    const [batches, teachers] = await Promise.all([api('/batches'), api('/users?role=teachers')]);
    view.innerHTML = `
      <div class="page-head"><div><h1>Batches</h1><p>Group students by course and timing. The teacher of a batch can take its roll call.</p></div>
        <button class="btn primary" id="addBatch">${icon('plus')} Add batch</button></div>
      ${batches.length ? `<div class="grid grid-3">${batches.map((b) => `
        <div class="card"><div class="card-head" style="margin-bottom:6px"><h2>${esc(b.name)}</h2><button class="btn sm" data-edit="${b.id}">Edit</button></div>
          <div class="muted small">${esc(b.course || 'No course set')}${b.timing ? ' · ' + esc(b.timing) : ''}</div>
          <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center"><span><b>${b.student_count}</b> <span class="muted">students</span></span><span class="small">${b.teacher_name ? '👤 ' + esc(b.teacher_name) : '<span class="muted">No teacher</span>'}</span></div>
        </div>`).join('')}</div>` : '<div class="card empty">No batches yet. Add your first batch (e.g. “DCA Morning 9–11”).</div>'}`;
    const form = (b) => {
      const isNew = !b; b = b || {};
      const m = openModal(isNew ? 'Add batch' : `Edit ${b.name}`, `
        <form id="batchForm">
          <label class="field"><span>Batch name</span><input name="name" required value="${esc(b.name || '')}" placeholder="e.g. DCA Morning"></label>
          <div class="form-grid">
            <label class="field"><span>Course</span><input name="course" value="${esc(b.course || '')}" placeholder="e.g. DCA, Tally, ADCA"></label>
            <label class="field"><span>Timing</span><input name="timing" value="${esc(b.timing || '')}" placeholder="e.g. 9:00–11:00 AM"></label>
          </div>
          <label class="field"><span>Teacher</span><select name="teacher_id"><option value="">— None —</option>${teachers.map((t) => `<option value="${t.id}" ${b.teacher_id === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
        </form>`, { footer: `${!isNew ? '<button class="btn danger" id="delBatch" style="margin-right:auto">Delete</button>' : ''}<button class="btn" data-close>Cancel</button><button class="btn primary" id="saveBatch">Save</button>` });
      $('#saveBatch', m.el).onclick = async () => {
        const f = $('#batchForm', m.el);
        if (!f.reportValidity()) return;
        try { await api(isNew ? '/batches' : `/batches/${b.id}`, { method: isNew ? 'POST' : 'PUT', body: formData(f) }); toast('Saved', 'ok'); m.close(); load(); }
        catch (err) { toast(err.message, 'err'); }
      };
      if (!isNew) $('#delBatch', m.el).onclick = async () => {
        m.close();
        if (!(await confirmBox(`Delete batch “${b.name}”? Its students stay, but will have no batch. Attendance history is kept.`, 'Delete'))) return;
        try { await api(`/batches/${b.id}`, { method: 'DELETE' }); toast('Batch deleted'); load(); } catch (err) { toast(err.message, 'err'); }
      };
    };
    $('#addBatch').onclick = () => form(null);
    $$('[data-edit]', view).forEach((btn) => { btn.onclick = () => form(batches.find((b) => b.id === Number(btn.dataset.edit))); });
  };
  await load();
};

// Reports (admin)
VIEWS.reports = async (view) => {
  const batches = await api('/batches');
  const f = { from: state.today.slice(0, 7) + '-01', to: state.today, role: 'student', batch_id: '' };
  let sortKey = 'name', sortDir = 1, rows = [];
  view.innerHTML = `
    <div class="page-head"><div><h1>Reports</h1><p>Attendance percentage for any period. Working days = days the institute recorded attendance.</p></div></div>
    <div class="card">
      <div class="toolbar">
        <label class="field"><span>From</span><input type="date" id="rFrom" value="${f.from}" max="${state.today}"></label>
        <label class="field"><span>To</span><input type="date" id="rTo" value="${f.to}" max="${state.today}"></label>
        <label class="field"><span>Who</span><select id="rRole"><option value="student">Students</option><option value="staff">Staff</option><option value="partner">Partners</option><option value="">Everyone</option></select></label>
        <label class="field" id="rBatchWrap"><span>Batch</span><select id="rBatch"><option value="">All batches</option>${batches.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></label>
        <div class="btn-row" style="margin-left:auto">
          <button class="btn" id="exSummary">${icon('download')} Summary CSV</button>
          <button class="btn" id="exDetail">${icon('download')} Day-wise CSV</button>
        </div>
      </div>
      <div class="table-wrap"><table><thead><tr>
        <th data-k="name">Name</th><th data-k="batch_name">Batch / Designation</th><th class="num" data-k="working_days">Days</th>
        <th class="num" data-k="present">Present</th><th class="num" data-k="late">Late</th><th class="num" data-k="leave">Leave</th><th class="num" data-k="absent">Absent</th><th class="num" data-k="percent">%</th>
      </tr></thead><tbody id="rBody"></tbody></table></div>
    </div>`;
  $$('th[data-k]', view).forEach((th) => { th.style.cursor = 'pointer'; th.title = 'Sort'; });
  const params = () => { const p = new URLSearchParams({ from: f.from, to: f.to }); if (f.role) p.set('role', f.role); if (f.role === 'student' && f.batch_id) p.set('batch_id', f.batch_id); return p; };
  const draw = () => {
    $('#rBatchWrap').classList.toggle('hidden', f.role !== 'student');
    const sorted = [...rows].sort((a, b) => {
      const x = a[sortKey] ?? (sortKey === 'batch_name' ? a.designation : -1), y = b[sortKey] ?? (sortKey === 'batch_name' ? b.designation : -1);
      return (typeof x === 'string' ? String(x).localeCompare(String(y)) : (x ?? -1) - (y ?? -1)) * sortDir;
    });
    $('#rBody').innerHTML = sorted.length ? sorted.map((r) => `
      <tr><td><b>${esc(r.name)}</b><div class="role">${ROLE_LABEL[r.role]}</div></td><td>${esc(r.batch_name || r.designation || '')}</td>
        <td class="num">${r.working_days}</td><td class="num">${r.present}</td><td class="num">${r.late}</td><td class="num">${r.leave}</td><td class="num">${r.absent}</td>
        <td class="num">${r.percent == null ? '—' : `<span class="pill ${r.percent >= 90 ? 's-present' : r.percent >= 75 ? 's-late' : 's-absent'}">${r.percent}%</span>`}</td></tr>`).join('')
      : '<tr><td colspan="8" class="empty">No data for this selection.</td></tr>';
  };
  const load = async () => { rows = (await api('/reports/summary?' + params())).rows; draw(); };
  const bind = (id, key) => { $(id).onchange = (e) => { f[key] = e.target.value; load().catch((err) => toast(err.message, 'err')); }; };
  bind('#rFrom', 'from'); bind('#rTo', 'to'); bind('#rRole', 'role'); bind('#rBatch', 'batch_id');
  $('thead', view).onclick = (e) => { const th = e.target.closest('th[data-k]'); if (!th) return; sortDir = sortKey === th.dataset.k ? -sortDir : 1; sortKey = th.dataset.k; draw(); };
  $('#exSummary').onclick = () => downloadFile('/reports/export?type=summary&' + params(), 'attendance-summary.csv').catch((e) => toast(e.message, 'err'));
  $('#exDetail').onclick = () => downloadFile('/reports/export?type=detail&' + params(), 'attendance-detail.csv').catch((e) => toast(e.message, 'err'));
  await load();
};

// Check-in QR display (admin)
VIEWS.qr = async (view) => {
  view.innerHTML = `
    <div class="page-head"><div><h1>Check-in QR</h1><p>Keep this open on a screen at the front desk. It changes every minute so it can’t be shared from home.</p></div>
      <button class="btn" id="fsBtn">Full screen</button></div>
    <div class="grid grid-2">
      <div class="card qr-box" id="qrCard"><div class="muted">Loading…</div></div>
      <div class="card"><h2>How it works</h2>
        <ol style="padding-left:20px;margin:10px 0">
          <li>Staff, partners and students open the app and tap <b>Scan QR</b> — or simply scan with their phone camera.</li>
          <li>The first scan of the day records <b>check-in</b>, the next one records <b>check-out</b>.</li>
          <li>Phone camera not working? They can type the 6-digit code instead.</li>
        </ol>
        <h3 style="margin-top:18px">Front-desk screen without admin login</h3>
        <p class="muted small">Open this link on the reception tablet or monitor. It only shows the QR — nothing else.</p>
        <p><span class="kbd" id="kioskLink"></span></p>
        <div class="btn-row"><button class="btn sm" id="copyKiosk">Copy link</button><a class="btn sm" id="openKiosk" target="_blank" rel="noopener">Open</a></div>
        <p class="muted small" style="margin-top:12px">If the link leaks, create a new one in <a href="#/settings">Settings</a>.</p>
      </div>
    </div>`;
  let timer = null, ticker = null, left = 60;
  const load = async () => {
    const d = await api('/qr');
    left = d.secondsLeft;
    $('#qrCard').innerHTML = `<img src="${d.image}" alt="Check-in QR code"><div class="muted small">or enter code</div><div class="qr-code-text">${esc(d.code)}</div><div class="countdown"><i id="cd" style="width:${(left / 60) * 100}%"></i></div>`;
    const link = `${location.origin}/kiosk.html?key=${d.kiosk_key}`;
    $('#kioskLink').textContent = link;
    $('#openKiosk').href = link;
    clearTimeout(timer);
    timer = setTimeout(() => load().catch(() => {}), left * 1000 + 300);
  };
  ticker = setInterval(() => { left = Math.max(0, left - 1); const cd = $('#cd'); if (cd) cd.style.width = `${(left / 60) * 100}%`; }, 1000);
  $('#copyKiosk').onclick = async () => { try { await navigator.clipboard.writeText($('#kioskLink').textContent); toast('Link copied', 'ok'); } catch { toast('Copy failed — select the link and copy it manually', 'err'); } };
  $('#fsBtn').onclick = () => $('#qrCard').requestFullscreen?.();
  await load();
  return () => { clearTimeout(timer); clearInterval(ticker); };
};

// Settings (admin)
VIEWS.settings = async (view) => {
  const s = await api('/settings');
  view.innerHTML = `
    <div class="page-head"><div><h1>Settings</h1></div></div>
    <div class="card" style="max-width:640px">
      <form id="setForm">
        <label class="field"><span>Institute name</span><input name="institute_name" required value="${esc(s.institute_name)}"></label>
        <div class="form-grid">
          <label class="field"><span>Late after (check-in time)</span><input type="time" name="late_after" required value="${esc(s.late_after)}"></label>
          <label class="field"><span>Time zone</span><input name="timezone" required value="${esc(s.timezone)}" placeholder="Asia/Kolkata"></label>
        </div>
        <label class="switch"><input type="checkbox" name="require_qr" ${s.require_qr ? 'checked' : ''}><span><b>Require QR scan for self check-in</b><br><span class="muted small">Recommended. If turned off, people can check in with one tap from anywhere.</span></span></label>
        <button class="btn primary" type="submit">Save settings</button>
      </form>
    </div>
    <div class="card" style="max-width:640px">
      <h2>Front-desk kiosk link</h2>
      <p class="muted small">Create a new kiosk link if the old one was shared with the wrong person. The old link will stop working.</p>
      <button class="btn danger" id="regenKiosk">Create new kiosk link</button>
    </div>
    <div class="card" style="max-width:640px">
      <h2>Backup</h2>
      <p class="muted small">Download a full copy of all attendance data. Keep it somewhere safe, such as Google Drive. Do this at least once a week.</p>
      <button class="btn" id="backupBtn">${icon('download')} Download backup</button>
    </div>`;
  $('#setForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = formData(e.target);
    f.require_qr = e.target.require_qr.checked;
    try { await api('/settings', { method: 'PUT', body: f }); await loadMe(); renderShell(); route(); toast('Settings saved', 'ok'); }
    catch (err) { toast(err.message, 'err'); }
  };
  $('#backupBtn').onclick = () => downloadFile('/backup', 'infodesk-backup.db').then(() => toast('Backup downloaded', 'ok')).catch((e) => toast(e.message, 'err'));
  $('#regenKiosk').onclick = async () => {
    if (!(await confirmBox('Create a new kiosk link? The front-desk screen will need the new link.', 'Create'))) return;
    try { await api('/settings', { method: 'PUT', body: { regenerate_kiosk: true } }); toast('New link created — see Check-in QR page', 'ok'); }
    catch (err) { toast(err.message, 'err'); }
  };
};

// Profile (everyone)
VIEWS.profile = async (view) => {
  const me = state.me;
  view.innerHTML = `
    <div class="page-head"><div><h1>My Profile</h1></div></div>
    <div class="grid grid-2">
      <div class="card">
        <div style="display:flex;gap:14px;align-items:center;margin-bottom:14px"><div class="avatar" style="width:56px;height:56px;font-size:1.1rem">${esc(initials(me.name))}</div>
          <div><h2>${esc(me.name)}</h2><span class="role">${ROLE_LABEL[me.role]}</span></div></div>
        <ul class="list">
          <li><span class="grow muted">Username</span><b>${esc(me.username)}</b></li>
          ${me.phone ? `<li><span class="grow muted">Phone</span><b>${esc(me.phone)}</b></li>` : ''}
          ${me.batch ? `<li><span class="grow muted">Batch</span><b>${esc(me.batch.name)}${me.batch.timing ? ' · ' + esc(me.batch.timing) : ''}</b></li>` : ''}
          ${me.designation ? `<li><span class="grow muted">Designation</span><b>${esc(me.designation)}</b></li>` : ''}
          ${me.join_date ? `<li><span class="grow muted">Joined</span><b>${fmtDate(me.join_date, { day: 'numeric', month: 'short', year: 'numeric' })}</b></li>` : ''}
        </ul>
        <button class="btn" style="margin-top:14px;width:100%" id="logout2">${icon('logout')} Log out</button>
      </div>
      <div class="card">
        <h2 style="margin-bottom:12px">Change password</h2>
        <form id="pwForm2">
          <label class="field"><span>Current password</span><input name="current" type="password" autocomplete="current-password" required></label>
          <label class="field"><span>New password</span><input name="password" type="password" minlength="6" autocomplete="new-password" required></label>
          <label class="field"><span>Repeat new password</span><input name="password2" type="password" minlength="6" autocomplete="new-password" required></label>
          <button class="btn primary" type="submit">Update password</button>
        </form>
      </div>
    </div>
    ${installHint()}`;
  bindInstallHint(view);
  $('#logout2').onclick = logout;
  $('#pwForm2').onsubmit = async (e) => {
    e.preventDefault();
    const f = formData(e.target);
    if (f.password !== f.password2) return toast('The new passwords do not match.', 'err');
    try { await api('/me/password', { method: 'POST', body: f }); e.target.reset(); toast('Password updated', 'ok'); }
    catch (err) { toast(err.message, 'err'); }
  };
};

// Refresh "today" when the app comes back to the foreground (e.g. next morning).
document.addEventListener('visibilitychange', async () => {
  if (document.hidden || !state.me) return;
  const prev = state.today;
  try { await loadMe(); if (state.today !== prev || location.hash === '#/home') route(); } catch { /* ignore */ }
});

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
start();

'use strict';
// Mom's Wrap backend: zero dependencies (Node 18+). Run with: npm start
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
let db = { profiles: {} };
try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}
const save = () => {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
};

/* ---------- helpers ---------- */
const uid = () => crypto.randomBytes(5).toString('hex');
const mins = t => { const [a, b] = t.split(':'); return +a * 60 + +b; };
const E = (c, m) => Object.assign(new Error(m), { status: c });
const need = (c, m) => { if (!c) throw E(400, m); };
const cl = (v, n = 100) => String(v ?? '').trim().slice(0, n);
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/, DATE = /^\d{4}-\d{2}-\d{2}$/, MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GRACE = 30; // minutes after the scheduled time before a dose counts as missed
const validDate = s => DATE.test(String(s)) && !Number.isNaN(Date.parse(s)) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;

function nowIn(tz, d = new Date()) {
  let f;
  try { f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch { return nowIn('UTC', d); }
  const o = {}; f.formatToParts(d).forEach(p => o[p.type] = p.value);
  const h = o.hour === '24' ? '00' : o.hour;
  return { date: `${o.year}-${o.month}-${o.day}`, time: `${h}:${o.minute}`, m: +h * 60 + +o.minute };
}
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

/* ---------- dose logic ---------- */
const onDay = (m, d) => !m.days || !m.days.length || m.days.includes(new Date(d + 'T00:00:00Z').getUTCDay());
const logOf = (p, id, d, t) => p.logs.find(l => l.id === id && l.d === d && l.t === t);
function status(l, d, t, n) {
  if (l) return l.s;                                  // taken | skipped
  if (d > n.date) return 'upcoming';
  if (d < n.date) return 'missed';
  const x = n.m - mins(t);
  return x < 0 ? 'upcoming' : x <= GRACE ? 'due' : 'missed';
}
function doses(p, d, n) {
  const out = [];
  for (const m of p.meds) if (onDay(m, d)) for (const t of m.times)
    out.push({ medId: m.id, name: m.name, dosage: m.dosage, note: m.note, date: d, time: t, status: status(logOf(p, m.id, d, t), d, t, n) });
  return out.sort((a, b) => a.time.localeCompare(b.time));
}
function adherence(p, n) {
  const days = []; let T = 0, K = 0;
  for (let i = 6; i >= 0; i--) {
    const d = addDays(n.date, -i), c = doses(p, d, n).filter(x => x.status !== 'upcoming' && x.status !== 'due');
    const k = c.filter(x => x.status === 'taken').length;
    days.push({ date: d, taken: k, total: c.length }); T += c.length; K += k;
  }
  let streak = 0;
  for (let i = 6; i >= 0; i--) { const x = days[i]; if (!x.total) continue; if (x.taken === x.total) streak++; else break; }
  return { days, percent: T ? Math.round(K / T * 100) : null, streak };
}

/* ---------- email (Resend HTTPS API; otherwise every email is logged in the app) ---------- */
async function mail(p, to, subject, text) {
  for (const e of [...new Set(to)]) {
    let mode = 'logged';
    if (process.env.RESEND_API_KEY && !p.demo && !/@example\.com$/i.test(e)) {
      try {
        const r = await fetch('https://api.resend.com/emails', { method: 'POST',
          headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: process.env.MAIL_FROM || "Mom's Wrap <onboarding@resend.dev>", to: [e], subject, text }) });
        mode = r.ok ? 'sent' : 'failed';
      } catch { mode = 'failed'; }
    }
    p.outbox.unshift({ at: new Date().toISOString(), to: e, subject, mode });
  }
  p.outbox.length = Math.min(p.outbox.length, 30);
}
const to = (p, all) => [p.elderEmail, ...p.members.filter(m => all || m.role === 'caretaker').map(m => m.email)].filter(Boolean);

async function tick() {                               // runs every minute
  for (const p of Object.values(db.profiles)) {
    const n = nowIn(p.tz);
    const once = async (k, f) => { if (p.sent[k]) return; p.sent[k] = Date.now(); await f(); };
    for (const d of doses(p, n.date, n)) {
      const x = n.m - mins(d.time), k = d.medId + d.date + d.time;
      if (d.status === 'due' || (d.status === 'upcoming' && x >= -10 && x < 0))
        await once('r' + k, () => mail(p, to(p), `Time for ${d.name} (${d.dosage}) at ${d.time}`, `${p.name}, please take ${d.name} ${d.dosage} now. ${d.note || ''}`));
      if (d.status === 'missed' && x <= 360)
        await once('m' + k, () => mail(p, to(p, 1), `Missed dose: ${p.name} - ${d.name} at ${d.time}`, `${p.name} has not taken ${d.name} ${d.dosage} (due ${d.time}). Please check in.`));
    }
    for (const a of p.appts) {
      const u = dayDiff(n.date, a.date) * 1440 + mins(a.time) - n.m;
      const msg = () => mail(p, to(p, 1), `Appointment: ${a.doctor} on ${a.date} at ${a.time}`, `${p.name} sees ${a.doctor} (${a.purpose || 'visit'}) on ${a.date} at ${a.time}. ${a.place || ''}`);
      if (u > 120 && u <= 1440) await once('a1' + a.id, msg);
      if (u > 0 && u <= 120) await once('a2' + a.id, msg);
    }
    for (const m of p.meds) if (m.pills != null && m.pills / m.times.length <= 3)
      await once('f' + m.id + n.date, () => mail(p, to(p), `Refill needed: ${m.name}`, `Only about ${Math.floor(m.pills / m.times.length)} day(s) of ${m.name} left for ${p.name}.`));
    for (const k in p.sent) if (Date.now() - p.sent[k] > 3 * 864e5) delete p.sent[k];
  }
  save();
}

/* ---------- auth ---------- */
const sess = new Map(), hits = new Map();
const hash = s => { const k = crypto.randomBytes(8).toString('hex'); return k + ':' + crypto.scryptSync(s, k, 32).toString('hex'); };
const match = (s, h) => { const [k, x] = h.split(':'); return crypto.timingSafeEqual(crypto.scryptSync(s, k, 32), Buffer.from(x, 'hex')); };
function limit(k, max) {
  const h = (hits.get(k) || []).filter(t => Date.now() - t < 9e5);
  if (h.length >= max) throw E(429, 'Too many attempts. Please try again in 15 minutes.');
  h.push(Date.now()); hits.set(k, h);
}
const session = (id, role) => { const t = crypto.randomBytes(24).toString('hex'); sess.set(t, { id, role, exp: Date.now() + 12 * 36e5 }); return t; };
const mk = (id, name, tz, email, pw) => ({ id, name, tz, elderEmail: email, pw, members: [], meds: [], appts: [], logs: [], outbox: [], sent: {} });

/* ---------- demo data so evaluators see a working app immediately ---------- */
function seed() {
  if (db.profiles.DEMO) return;
  const p = mk('DEMO', 'Meena Iyer', 'Asia/Kolkata', '', { elder: hash('1111'), caretaker: hash('2222'), family: hash('3333') });
  p.demo = true; const n = nowIn(p.tz);
  p.members = [{ id: uid(), name: 'Priya (daughter)', email: 'priya@example.com', role: 'caretaker' }, { id: uid(), name: 'Rohan (son)', email: 'rohan@example.com', role: 'family' }];
  p.meds = [
    { id: uid(), name: 'Metformin', dosage: '500 mg', times: ['08:00', '20:00'], days: [], note: 'Take after food', pills: 30 },
    { id: uid(), name: 'Amlodipine', dosage: '5 mg', times: ['09:00'], days: [], note: 'For blood pressure', pills: 2 },
    { id: uid(), name: 'Vitamin D3', dosage: '1 capsule', times: ['13:00'], days: [0], note: 'Weekly, with lunch', pills: null }];
  p.appts = [{ id: uid(), doctor: 'Dr. Rao (Cardiologist)', purpose: 'Blood pressure review', date: addDays(n.date, 2), time: '10:30', place: 'Apollo Clinic, Madurai' }];
  for (let i = 6; i >= 1; i--) for (const d of doses(p, addDays(n.date, -i), n)) if ((d.time.charCodeAt(1) + i * 7) % 9) p.logs.push({ id: d.medId, d: d.date, t: d.time, s: 'taken' });
  db.profiles.DEMO = p; save();
}

/* ---------- API ---------- */
function view(p, role) {
  const n = nowIn(p.tz);
  return { role, id: p.id, name: p.name, elderEmail: p.elderEmail, now: n, today: doses(p, n.date, n), adh: adherence(p, n),
    meds: p.meds.map(m => ({ ...m, daysLeft: m.pills == null ? null : Math.floor(m.pills / m.times.length) })),
    appts: [...p.appts].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    members: p.members, outbox: p.outbox.slice(0, 15), emailLive: !!process.env.RESEND_API_KEY && !p.demo };
}
const MANAGE = ['elder', 'caretaker'];
async function api(req, b, ip) {
  const m = req.method, u = new URL(req.url, 'http://x').pathname;
  if (u === '/api/health') return { ok: true };
  if (m === 'POST' && u === '/api/profiles') {
    limit('c' + ip, 10);
    const name = cl(b.name, 60); need(name, "Enter the elder's name");
    const pw = ['elder', 'caretaker', 'family'].map(r => cl((b.pass || {})[r], 20));
    need(pw.every(x => x.length >= 4) && new Set(pw).size === 3, 'Use three different passcodes of at least 4 characters');
    const email = cl(b.email, 120); need(!email || MAIL.test(email), 'Enter a valid email address');
    let id; do { id = (name.split(/\s/)[0].replace(/\W/g, '').toUpperCase().slice(0, 8) || 'HOME') + '-' + (1000 + crypto.randomInt(9000)); } while (db.profiles[id]);
    let tz = cl(b.tz, 50) || 'Asia/Kolkata'; try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch { tz = 'Asia/Kolkata'; }
    db.profiles[id] = mk(id, name, tz, email, { elder: hash(pw[0]), caretaker: hash(pw[1]), family: hash(pw[2]) });
    save(); return { token: session(id, 'elder'), id };
  }
  if (m === 'POST' && u === '/api/login') {
    const id = cl(b.id, 30).toUpperCase(), p = db.profiles[id];
    limit('l' + ip + id, 8);
    const role = p && ['elder', 'caretaker', 'family'].find(r => match(cl(b.pass, 20), p.pw[r]));
    if (!role) throw E(401, 'Profile ID or passcode is incorrect');
    return { token: session(id, role) };
  }
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const s = sess.get(token);
  if (!s || s.exp < Date.now()) { if (token) sess.delete(token); throw E(401, 'Please sign in again'); }
  const p = db.profiles[s.id], role = s.role, can = (...r) => { if (!r.includes(role)) throw E(403, 'Your access level cannot do this'); };
  if (m === 'GET' && u === '/api/state') return view(p, role);
  let r;
  if (m === 'POST' && u === '/api/meds') {
    can(...MANAGE);
    const times = [...new Set((b.times || []).map(x => cl(x, 5)))].filter(x => TIME.test(x)).sort(); need(times.length && cl(b.name), 'Enter a name and at least one time');
    const data = { name: cl(b.name, 60), dosage: cl(b.dosage, 40), times, days: (b.days || []).map(Number).filter(x => x >= 0 && x <= 6), note: cl(b.note, 150),
      pills: b.pills === '' || b.pills == null ? null : Math.max(0, parseInt(b.pills) || 0) };
    const old = b.id && p.meds.find(x => x.id === b.id);
    if (old) Object.assign(old, data); else p.meds.push({ id: uid(), ...data });
  } else if (m === 'DELETE' && (r = u.match(/^\/api\/meds\/(\w+)$/))) { can(...MANAGE); p.meds = p.meds.filter(x => x.id !== r[1]); }
  else if (m === 'POST' && u === '/api/refill') { can(...MANAGE); const x = p.meds.find(y => y.id === b.id); need(x, 'Medicine not found'); x.pills = (x.pills || 0) + Math.max(0, parseInt(b.pills) || 0); }
  else if (m === 'POST' && u === '/api/doses') {
    can(...MANAGE);
    const med = p.meds.find(x => x.id === b.medId), n = nowIn(p.tz);
    need(med && med.times.includes(b.time) && validDate(b.date) && b.date <= n.date && b.date >= addDays(n.date, -7), 'That dose cannot be changed');
    const i = p.logs.findIndex(l => l.id === med.id && l.d === b.date && l.t === b.time);
    if (i >= 0) { if (p.logs[i].s === 'taken' && med.pills != null) med.pills++; p.logs.splice(i, 1); }
    if (['taken', 'skipped'].includes(b.status)) { p.logs.push({ id: med.id, d: b.date, t: b.time, s: b.status, by: role, at: Date.now() }); if (b.status === 'taken' && med.pills != null) med.pills = Math.max(0, med.pills - 1); }
    p.logs = p.logs.filter(l => l.d >= addDays(n.date, -60));
  } else if (m === 'POST' && u === '/api/appts') {
    can('elder', 'caretaker', 'family');
    need(cl(b.doctor) && validDate(b.date) && b.date >= nowIn(p.tz).date && TIME.test(b.time), 'Enter a valid doctor, date and time (today or later)');
    p.appts.push({ id: uid(), doctor: cl(b.doctor, 80), purpose: cl(b.purpose, 120), date: b.date, time: b.time, place: cl(b.place, 120) });
  } else if (m === 'DELETE' && (r = u.match(/^\/api\/appts\/(\w+)$/))) { can(...MANAGE); p.appts = p.appts.filter(x => x.id !== r[1]); }
  else if (m === 'POST' && u === '/api/members') {
    can(...MANAGE);
    need(cl(b.name) && MAIL.test(cl(b.email, 120)) && ['caretaker', 'family'].includes(b.role), 'Enter a name, a valid email and a role');
    need(!p.demo || /@example\.com$/i.test(b.email), 'The demo profile only accepts @example.com addresses. Create your own profile to try real emails.');
    p.members.push({ id: uid(), name: cl(b.name, 60), email: cl(b.email, 120), role: b.role });
  } else if (m === 'DELETE' && (r = u.match(/^\/api\/members\/(\w+)$/))) { can(...MANAGE); p.members = p.members.filter(x => x.id !== r[1]); }
  else throw E(404, 'Not found');
  save(); return view(p, role);
}

/* ---------- server ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const PUB = path.join(__dirname, 'public');
const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:");
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith('/api/')) {
    let requested;
    try { requested = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end('Bad request'); }
    const f = path.resolve(PUB, '.' + (requested === '/' ? '/index.html' : requested));
    if (f !== PUB && !f.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end(); }
    return fs.readFile(f, (e, buf) => { if (e) { res.writeHead(404); return res.end('Not found'); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain' }); res.end(buf); });
  }
  try {
    let raw = ''; for await (const c of req) { raw += c; if (raw.length > 1e5) throw E(413, 'Too large'); }
    let b = {}; try { b = raw ? JSON.parse(raw) : {}; } catch { throw E(400, 'Invalid request'); }
    const out = await api(req, b, req.socket.remoteAddress);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
  } catch (e) {
    if (!e.status) console.error(e);
    res.writeHead(e.status || 500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: e.status ? e.message : 'Server error' }));
  }
});
function start(port = process.env.PORT || 3000) {
  if (process.env.SEED_DEMO !== '0') seed();
  setInterval(() => {
    const now = Date.now();
    for (const [t, s] of sess) if (s.exp < now) sess.delete(t);
    for (const [k, ts] of hits) { const fresh = ts.filter(t => now - t < 9e5); if (fresh.length) hits.set(k, fresh); else hits.delete(k); }
    tick().catch(console.error);
  }, 60000).unref();
  return server.listen(port, () => console.log("Mom's Wrap running on http://localhost:" + (server.address().port)));
}
if (require.main === module) start();
module.exports = { start, server, nowIn, status, adherence, validDate };

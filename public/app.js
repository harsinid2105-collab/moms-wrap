'use strict';
const $ = s => document.querySelector(s), R = $('#main');
let tok = sessionStorage.cc, S = null, tab = 'today', editing = null, size = +localStorage.size || 0;
const h = (t, a, ...k) => {
  const e = document.createElement(t);
  for (const [x, v] of Object.entries(a || {})) { if (v == null || v === false) continue;
    if (x.startsWith('on')) e.addEventListener(x.slice(2), v); else if (x === 'class') e.className = v; else e.setAttribute(x, v === true ? '' : v); }
  e.append(...k.flat().filter(c => c != null && c !== false)); return e;
};
async function api(p, m = 'GET', b) {
  const r = await fetch('/api' + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: b ? JSON.stringify(b) : undefined });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && tok) signOut();
  if (!r.ok) throw new Error(d.error || 'Something went wrong');
  return d;
}
const toast = (m, bad) => { const t = $('#toast'); t.textContent = m; t.className = bad ? 'bad show' : 'show'; setTimeout(() => t.className = '', 3500); };
const run = f => async (...a) => { try { await f(...a); } catch (e) { toast(e.message, 1); } };
const fmtT = t => { const [H, M] = t.split(':'); return `${(H % 12) || 12}:${M} ${H >= 12 ? 'PM' : 'AM'}`; };
const fmtD = d => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LABEL = { taken: 'Taken', skipped: 'Skipped', due: 'Take now', missed: 'Missed', upcoming: 'Later' };
const field = (l, n, a = {}) => h('label', {}, l, h('input', { name: n, ...a }));
const fd = e => Object.fromEntries(new FormData(e.target));

/* ----- sign in ----- */
async function signIn(id, pass) { const d = await api('/login', 'POST', { id, pass }); tok = d.token; sessionStorage.cc = tok; await load(); }
function loginView() {
  $('#nav').hidden = true; $('#out').hidden = true; document.body.dataset.role = '';
  R.replaceChildren(
    h('section', { class: 'card' }, h('h2', {}, 'Sign in to a care profile'),
      h('form', { onsubmit: run(async e => { e.preventDefault(); const f = fd(e); await signIn(f.id, f.pass); }) },
        field('Profile ID', 'id', { required: true, autocomplete: 'username' }), field('Passcode', 'pass', { type: 'password', required: true, autocomplete: 'current-password' }),
        h('button', { class: 'primary' }, 'Sign in'))),
    h('section', { class: 'card' }, h('h2', {}, 'Try the demo'), h('p', { class: 'muted' }, 'Same family profile, three levels of access.'),
      h('div', { class: 'row' },
        h('button', { onclick: run(() => signIn('DEMO', '1111')) }, 'Meena (elder)'),
        h('button', { onclick: run(() => signIn('DEMO', '2222')) }, 'Priya (caretaker)'),
        h('button', { onclick: run(() => signIn('DEMO', '3333')) }, 'Rohan (family)'))),
    h('section', { class: 'card' }, h('h2', {}, 'Create a care profile'),
      h('form', { onsubmit: run(async e => { e.preventDefault(); const f = fd(e);
          const d = await api('/profiles', 'POST', { name: f.name, email: f.email, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, pass: { elder: f.elder, caretaker: f.caretaker, family: f.family } });
          tok = d.token; sessionStorage.cc = tok; await load(); toast('Profile created. Your Profile ID is ' + d.id); }) },
        field("Elder's name", 'name', { required: true }), field("Elder's email (for reminders)", 'email', { type: 'email' }),
        field('Elder passcode (full control)', 'elder', { required: true, minlength: 4 }),
        field('Caretaker passcode (can manage medicines)', 'caretaker', { required: true, minlength: 4 }),
        field('Family passcode (view and add appointments)', 'family', { required: true, minlength: 4 }),
        h('button', { class: 'primary' }, 'Create profile'))));
}
function signOut() { tok = null; S = null; delete sessionStorage.cc; loginView(); }

/* ----- main app ----- */
async function load() { S = await api('/state'); render(); }
const act = f => run(async (...a) => { S = await f(...a); render(); });
const mark = (d, status) => act(() => api('/doses', 'POST', { medId: d.medId, date: d.date, time: d.time, status }));

function render() {
  if (!S) return loginView();
  document.body.dataset.role = S.role; $('#out').hidden = false;
  const nav = $('#nav'); nav.hidden = false;
  nav.replaceChildren(...[['today', 'Today'], ['meds', 'Medicines'], ['appts', 'Visits'], ['circle', 'Circle & report']].map(([k, l]) =>
    h('button', { 'aria-current': tab === k ? 'page' : null, onclick: () => { tab = k; editing = null; render(); scrollTo(0, 0); } }, l)));
  R.replaceChildren(...({ today, meds, appts, circle }[tab])());
}

function today() {
  const { now, today: ds, name, role } = S, manage = role !== 'family';
  const greet = now.m < 720 ? 'Good morning' : now.m < 1020 ? 'Good afternoon' : 'Good evening';
  const next = ds.find(d => d.status === 'due') || ds.find(d => d.status === 'upcoming');
  const missed = ds.filter(d => d.status === 'missed'), low = S.meds.filter(m => m.daysLeft != null && m.daysLeft <= 3);
  const appt = S.appts.find(a => a.date + a.time >= now.date + now.time);
  const acts = d => h('span', { class: 'row' }, manage && h('button', { class: 'primary', onclick: mark(d, 'taken') }, 'I took it'), manage && h('button', { onclick: mark(d, 'skipped') }, 'Skip'));
  return [
    h('h2', {}, `${greet}, ${role === 'elder' ? name.split(' ')[0] : 'care team'}`),
    h('p', { class: 'muted' }, fmtD(now.date) + ' - ', S.id),
    missed.length ? h('div', { class: 'banner bad', role: 'alert' }, `${missed.length} dose(s) missed today. Caretakers have been emailed.`) : null,
    ...low.map(m => h('div', { class: 'banner' }, `${m.name}: about ${m.daysLeft} day(s) of tablets left.`, ' ', manage && h('button', { onclick: act(async () => { const n = prompt('How many tablets were added?'); return n ? api('/refill', 'POST', { id: m.id, pills: n }) : S; }) }, 'Add tablets'))),
    next ? h('section', { class: 'hero' }, h('p', {}, next.status === 'due' ? 'Take now' : 'Next medicine'), h('div', { class: 'time' }, fmtT(next.time)),
      h('h3', {}, `${next.name} ${next.dosage}`), h('p', {}, next.note), manage ? h('div', { class: 'row' }, acts(next)) : h('p', {}, 'Waiting for the dose to be taken.'))
      : h('section', { class: 'hero' }, h('h3', {}, ds.length ? 'All medicines handled for today' : 'No medicines scheduled today')),
    h('section', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, "Today's medicines"),
      h('button', { class: 'noprint', onclick: () => speak(greet, ds, appt) }, 'Read aloud')),
      ds.length ? ds.map(d => h('div', { class: 'dose' }, h('span', { class: 't' }, fmtT(d.time)),
        h('span', { class: 'grow' }, h('b', {}, `${d.name} ${d.dosage}`), h('br'), h('small', { class: 'muted' }, d.note)),
        h('span', { class: 'pill ' + d.status }, LABEL[d.status]),
        manage && ['taken', 'skipped'].includes(d.status) ? h('button', { onclick: mark(d, 'pending') }, 'Undo') : (manage && d.status !== 'upcoming' ? acts(d) : null)))
        : h('p', { class: 'muted' }, 'Nothing scheduled. Add a medicine in the Medicines tab.')),
    appt ? h('section', { class: 'card' }, h('h2', {}, 'Next doctor visit'), h('p', {}, h('b', {}, appt.doctor), ` - ${fmtD(appt.date)}, ${fmtT(appt.time)}`, h('br'), appt.purpose, appt.place ? ' - ' + appt.place : '')) : null,
  ];
}
function speak(greet, ds, appt) {
  const t = `${greet}. ` + (ds.length ? ds.map(d => `At ${fmtT(d.time)}, ${d.name} ${d.dosage}. ${d.status === 'taken' ? 'Already taken.' : ''}`).join(' ') : 'No medicines today.') + (appt ? ` Next doctor visit: ${appt.doctor}, ${fmtD(appt.date)} at ${fmtT(appt.time)}.` : '');
  speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(t));
}

function meds() {
  const m = S.meds.find(x => x.id === editing) || {}, times = m.times || ['08:00'];
  const timesBox = h('div', { class: 'times' });
  const addTime = v => { const r = h('span', { class: 'row' }, h('input', { type: 'time', name: 't', value: v, required: true, 'aria-label': 'Dose time' }), h('button', { type: 'button', onclick: () => r.remove(), 'aria-label': 'Remove time' }, 'x')); timesBox.append(r); };
  times.forEach(addTime);
  return [
    h('section', { class: 'card manage' }, h('h2', {}, m.id ? 'Edit medicine' : 'Add a medicine'),
      h('form', { onsubmit: act(async e => { e.preventDefault(); const f = new FormData(e.target);
          const r = await api('/meds', 'POST', { id: m.id, name: f.get('name'), dosage: f.get('dosage'), note: f.get('note'), pills: f.get('pills'), times: f.getAll('t'), days: f.getAll('d').length === 7 ? [] : f.getAll('d') });
          editing = null; toast('Medicine saved'); return r; }) },
        field('Medicine name', 'name', { required: true, value: m.name || '' }), field('Dose (for example 500 mg)', 'dosage', { value: m.dosage || '' }),
        h('p', {}, h('b', {}, 'Times each day')), timesBox, h('button', { type: 'button', onclick: () => addTime('12:00') }, 'Add another time'),
        h('p', {}, h('b', {}, 'Days')), h('div', { class: 'days' }, DAYS.map((d, i) => h('label', {}, h('input', { type: 'checkbox', name: 'd', value: i, checked: !m.days || !m.days.length || m.days.includes(i) }), d))),
        field('Tablets left (optional, for refill alerts)', 'pills', { type: 'number', min: 0, value: m.pills ?? '' }), field('Instructions', 'note', { value: m.note || '' }),
        h('div', { class: 'row' }, h('button', { class: 'primary' }, 'Save medicine'), m.id && h('button', { type: 'button', onclick: () => { editing = null; render(); } }, 'Cancel')))),
    h('section', { class: 'card' }, h('h2', {}, 'All medicines'),
      S.meds.length ? S.meds.map(x => h('div', { class: 'dose' }, h('span', { class: 'grow' }, h('b', {}, `${x.name} ${x.dosage}`), h('br'), h('small', { class: 'muted' }, x.times.map(fmtT).join(', ') + ' - ' + (x.days.length ? x.days.map(d => DAYS[d]).join(' ') : 'every day') + (x.daysLeft != null ? ` - ${x.daysLeft} day(s) of tablets left` : ''))),
        h('span', { class: 'row manage' }, h('button', { onclick: () => { editing = x.id; render(); scrollTo(0, 0); } }, 'Edit'),
          h('button', { class: 'danger', onclick: act(async () => confirm(`Delete ${x.name}?`) ? api('/meds/' + x.id, 'DELETE') : S) }, 'Delete')))) : h('p', { class: 'muted' }, 'No medicines yet.')),
  ];
}

function appts() {
  return [
    h('section', { class: 'card' }, h('h2', {}, 'Add a doctor visit'),
      h('form', { onsubmit: act(async e => { e.preventDefault(); const f = fd(e); const r = await api('/appts', 'POST', f); e.target.reset(); toast('Visit saved. Reminders will be emailed.'); return r; }) },
        field('Doctor', 'doctor', { required: true }), field('Reason', 'purpose'), field('Date', 'date', { type: 'date', min: S.now.date, value: S.now.date, required: true }), field('Time', 'time', { type: 'time', required: true }), field('Place', 'place'),
        h('button', { class: 'primary' }, 'Save visit'))),
    h('section', { class: 'card' }, h('h2', {}, 'Upcoming visits'),
      S.appts.length ? S.appts.map(a => h('div', { class: 'dose' }, h('span', { class: 'grow' }, h('b', {}, a.doctor), h('br'), `${fmtD(a.date)}, ${fmtT(a.time)}`, h('br'), h('small', { class: 'muted' }, [a.purpose, a.place].filter(Boolean).join(' - '))),
        h('button', { class: 'danger manage', onclick: act(async () => confirm('Delete this visit?') ? api('/appts/' + a.id, 'DELETE') : S) }, 'Delete'))) : h('p', { class: 'muted' }, 'No visits booked.')),
  ];
}

function circle() {
  const a = S.adh, max = Math.max(1, ...a.days.map(d => d.total));
  return [
    h('section', { class: 'card' }, h('div', { class: 'row' }, h('h2', { class: 'grow' }, 'Weekly adherence report'), h('button', { class: 'noprint', onclick: () => print() }, 'Print for doctor')),
      h('p', {}, h('b', {}, a.percent == null ? 'No data yet' : a.percent + '% of doses taken'), ` in the last 7 days. Current streak: ${a.streak} perfect day(s).`),
      h('div', { class: 'bars', role: 'img', 'aria-label': 'Doses taken per day for the last 7 days' }, a.days.map(d => { const b = h('div', { class: 'bar' }, h('span', {}, `${d.taken}/${d.total}`), h('i')); b.querySelector('i').style.setProperty('--h', (d.total ? d.taken / max * 100 : 0) + '%'); b.append(new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short' })); return b; }))),
    h('section', { class: 'card' }, h('h2', {}, 'Care circle'), h('p', {}, 'Share Profile ID ', h('b', {}, S.id), ' and the right passcode with family. Everyone below gets email alerts.'),
      h('p', { class: 'muted' }, 'Elder: ' + (S.elderEmail || 'no email set')),
      S.members.map(m => h('div', { class: 'dose' }, h('span', { class: 'grow' }, h('b', {}, m.name), h('br'), h('small', { class: 'muted' }, `${m.email} - ${m.role}`)),
        h('button', { class: 'danger manage', onclick: act(() => api('/members/' + m.id, 'DELETE')) }, 'Remove'))),
      h('form', { class: 'manage', onsubmit: act(async e => { e.preventDefault(); const r = await api('/members', 'POST', fd(e)); e.target.reset(); return r; }) },
        field('Name', 'name', { required: true }), field('Email', 'email', { type: 'email', required: true }),
        h('label', {}, 'Role', h('select', { name: 'role' }, h('option', { value: 'caretaker' }, 'Caretaker (manages medicines)'), h('option', { value: 'family' }, 'Family (views and adds visits)'))),
        h('button', { class: 'primary' }, 'Add to care circle'))),
    h('section', { class: 'card noprint' }, h('h2', {}, 'Email reminders sent'),
      h('p', { class: 'muted' }, S.emailLive ? 'Emails are delivered live.' : 'Demo mode: emails are recorded here (add RESEND_API_KEY to deliver them).'),
      S.outbox.length ? S.outbox.map(o => h('div', { class: 'mail' }, h('b', {}, o.subject), h('br'), `To ${o.to} - ${o.mode} - ${new Date(o.at).toLocaleString()}`)) : h('p', { class: 'muted' }, 'Nothing sent yet. Reminders go out 10 minutes before a dose, when a dose is missed, 24 hours and 2 hours before visits, and when tablets run low.')),
  ];
}

/* ----- accessibility controls ----- */
const setSize = () => { document.documentElement.className = 's' + size; localStorage.size = size; };
$('#sm').onclick = () => { size = Math.max(0, size - 1); setSize(); }; $('#lg').onclick = () => { size = Math.min(2, size + 1); setSize(); };
$('#hc').onclick = e => { const on = document.body.classList.toggle('hc'); e.target.setAttribute('aria-pressed', on); };
$('#out').onclick = signOut; setSize();
setInterval(() => { if (tok && document.visibilityState === 'visible' && !document.querySelector('form :focus')) load().catch(() => {}); }, 60000);
tok ? load().catch(signOut) : loginView();

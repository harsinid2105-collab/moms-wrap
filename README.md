# Mom's Wrap — A little care, every day

**Mom's Wrap** is an elder-centred medication and appointment companion that helps older adults stay in control while keeping trusted family members and caretakers in the loop.

> **The idea:** care should feel like a circle of support, not another complicated app.

**Live demo:** _add deployed URL_  
**Demo profile:** `DEMO` · Elder `1111` · Caretaker `2222` · Family `3333`

## Why it matters
Medication routines can become difficult to manage when schedules, refills, appointments and family communication are scattered across notebooks and messages. Mom's Wrap brings those everyday tasks into one simple shared space, designed around the older adult.

## What makes it useful
- **Three role-based passcodes:** elder, caretaker and family members get different levels of access to one shared profile.
- **Simple medication routine:** add medicines, dosage labels, multiple dose times, weekdays, instructions and remaining tablet counts.
- **One-tap adherence log:** mark a dose taken, skipped or undo a mistaken entry; review a seven-day adherence summary.
- **Missed-dose escalation:** the care circle can be notified when a dose remains unrecorded.
- **Appointment companion:** record doctor, purpose, date, time and place, with advance reminders.
- **Refill awareness:** low tablet counts trigger a reminder.
- **Designed for older adults:** large readable type, high contrast, keyboard focus indicators, touch-friendly controls and read-aloud support.
- **Useful hand-off:** print a weekly adherence summary to discuss with a clinician.

## Quick demo walkthrough
1. Open the app and choose **Meena (elder)** to see the elder view.
2. Go to **Medicines** to inspect the sample schedule and remaining tablet count.
3. Mark a dose as taken and open **Circle & report** to see the adherence report.
4. Sign out and enter as **Priya (caretaker)** (`DEMO` / `2222`) to explore medicine management.
5. Sign out and enter as **Rohan (family)** (`DEMO` / `3333`) to see the limited family view.
6. Add a doctor visit and inspect the reminder log.

## Run locally
Requires Node.js 18 or later. No third-party packages are required.

```bash
npm start
```
Open `http://localhost:3000`. Run tests with `npm test`.

## Email reminders
Without an email provider key, reminders are recorded in the in-app outbox. To enable delivery, configure `RESEND_API_KEY` and optionally `MAIL_FROM` in the deployment environment. Verify the sender/domain with Resend before using real recipients.

## Deployment notes
Deploy as a Node web service (for example, Render) with start command `npm start`. The prototype stores data in local `data.json` and runs reminders in the web process. Hosts with ephemeral storage or sleeping instances can lose data or pause reminders. Before real use, connect a persistent database, reliable background worker/queue, backups and monitoring.

## Safety, privacy and scope
Mom's Wrap is a hackathon prototype, not a medical device or clinical decision-support system. It does not prescribe medicines, calculate doses or replace a clinician's instructions. Use fictional demo data during judging. A real deployment needs privacy/security review, persistent storage, audit trails, consent controls and reliability testing.

## Tech stack
- Frontend: semantic HTML, CSS and vanilla JavaScript
- Backend: Node.js built-in HTTP server and JSON API
- Authentication: scrypt-hashed passcodes, role checks, expiring in-memory sessions and rate limiting
- Email: optional Resend API integration; local outbox in demo mode
- Tests: Node's built-in test runner

## LinkedIn post starter
I built **Mom's Wrap**, an elder-centred medication and appointment companion for PromptWars.

It brings medicine schedules, dose tracking, doctor visits and family reminders into one accessible shared space. The goal is simple: help older adults stay in control while making it easier for trusted people to support them.

Built with Google Antigravity.
Live demo: [add link] · GitHub: [add link]

#PromptWars #ElderCare #HealthTech #Accessibility #GoogleAntigravity

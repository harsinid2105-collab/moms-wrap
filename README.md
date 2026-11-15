# Mom's Wrap — A little care, every day

**Mom's Wrap** is an elder-centred medication and appointment companion that helps older adults stay in control while keeping trusted family members and caretakers in the loop.

> Care should feel like a circle of support, not another complicated app.

## Project links

- **Live demo:** Add the deployed URL when available.
- **Repository:** https://github.com/harsinid2105-collab/moms-wrap
- **Demo profile:** `DEMO` — Elder `1111`, Caretaker `2222`, Family `3333`

## Features

- Role-based elder, caretaker, and family access to a shared profile.
- Medicine schedules with dose times, weekdays, instructions, and tablet counts.
- Taken/skipped dose logging, undo, and a seven-day adherence summary.
- Missed-dose and low-refill reminders, plus appointment reminders.
- Accessible design with adjustable text size, high contrast, keyboard focus indicators, touch-friendly controls, and read-aloud support.
- Printable weekly adherence report.
- Optional email delivery through Resend; without a key, messages are recorded in the in-app outbox.

## Quick demo walkthrough

1. Start the app and choose **Meena (elder)** to explore the elder view.
2. Open **Medicines** to view the sample schedule and tablet count.
3. Mark a dose as taken and open **Circle & report** to see adherence.
4. Sign out and choose **Priya (caretaker)** (`DEMO` / `2222`) to explore medicine management.
5. Sign out and choose **Rohan (family)** (`DEMO` / `3333`) to see the limited family view.
6. Add a doctor visit and inspect the reminder log.

## Run locally

Requires Node.js 18 or later. No third-party packages are required.

```bash
npm start
```

Then open http://localhost:3000. Run the tests with:

```bash
npm test
```

## Project structure

```text
.
├── public/
│   ├── app.js          # Browser UI and interactions
│   ├── index.html      # App entry point
│   └── style.css       # Responsive and accessible styling
├── test/
│   └── validation.test.js
├── .gitignore
├── package.json
├── README.md
└── server.js           # Node.js HTTP server, API, auth, and reminders
```

Runtime data is stored in `data.json` (ignored by Git). Set `DATA_FILE` to use a different local file. Set `SEED_DEMO=0` to disable demo profile seeding.

## Email reminders

Without an email provider key, reminders are recorded in the in-app outbox. To enable delivery, configure `RESEND_API_KEY` and optionally `MAIL_FROM` in the deployment environment. Verify the sender/domain with Resend before using real recipients.

## Deployment notes

Deploy as a Node web service (for example, Render) with start command `npm start`. The prototype stores data in a local JSON file and runs reminders in the web process. Hosts with ephemeral storage or sleeping instances can lose data or pause reminders. Before real use, add a persistent database, reliable background worker/queue, backups, monitoring, and security/privacy review.

## Safety, privacy, and scope

Mom's Wrap is a hackathon prototype, not a medical device or clinical decision-support system. It does not prescribe medicines, calculate doses, or replace a clinician's instructions. Use fictional demo data during judging. A real deployment needs privacy/security review, persistent storage, audit trails, consent controls, and reliability testing. Do not enter real health information into the public demo.

## Tech stack

- Frontend: semantic HTML, CSS, and vanilla JavaScript
- Backend: Node.js built-in HTTP server and JSON API
- Authentication: scrypt-hashed passcodes, role checks, expiring in-memory sessions, and rate limiting
- Email: optional Resend API integration; local outbox in demo mode
- Tests: Node's built-in test runner

## Submission post starter

I built **Mom's Wrap**, an elder-centred medication and appointment companion.

It brings medicine schedules, dose tracking, doctor visits, and family reminders into one accessible shared space. The goal is simple: help older adults stay in control while making it easier for trusted people to support them.

Live demo: [add link] · GitHub: https://github.com/harsinid2105-collab/moms-wrap

#PromptWars #ElderCare #HealthTech #Accessibility #GoogleAntigravity

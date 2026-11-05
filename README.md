# Gold Country Directory — React + Node.js

A private, self-contained recreation of the Gold Country community directory. This branch ports the existing Django implementation to **React + TypeScript, Express + TypeScript, and PostgreSQL**, with a local SQLite fallback. Main/source history retains the Django version; this branch has no Python runtime dependency.

## What is preserved

- 342 public business records, all 73 original source categories (87 materialized categories including names referenced by businesses), and one public review.
- All 275 preserved source-asset files (including 274 distinct primary-image paths plus one premium-image asset), unchanged at `static/source-assets/`; stable source IDs and legacy business links.
- Familiar public navigation, grouped/searchable directory, filters, favorites, business profiles, About/Contact/Privacy, and responsive layouts.
- Email accounts, password reset/change, pending business submissions and edits, owner isolation, moderated reviews and ownership claims.
- Administrator queues for business/review/claim approvals, edit/removal/duplicate requests, website submissions, and contact messages. Reviewing a request does not silently delete, merge, or modify a business.
- Portable, idempotent public import/export. Imported claim labels never establish local account ownership.
- Client corrections live in `data/client-updates.json` and are layered over the untouched snapshot at seed time, so the preserved files stay byte-identical.

## Run locally

Use **Node.js 24 LTS** and npm (supported engine `>=22.12`).

```bash
npm ci
cp .env.example .env
# Replace SESSION_SECRET in .env with a unique random value of at least 32 characters.
npm run dev
```

Open `http://localhost:3000`. One Express process serves the same-origin API and Vite development middleware. Development automatically applies migrations, idempotently imports the preserved public seed, and applies the client overlay. The default database, uploaded photos, and password-reset email files live under ignored `var/`. `.env` is read by development, compiled startup, and CLI commands.

For PostgreSQL set `DATABASE_URL` to your own PostgreSQL connection string before starting. Do not reuse production credentials for tests.

```bash
npm run typecheck
npm test
npm run build
NODE_ENV=production AUTO_MIGRATE=true AUTO_SEED=true npm start
```

The last command is for a **single-instance local production-mode preview** with configured `.env`; multi-instance deployment runs migrations/seeding separately and keeps both startup flags false.

## Administrator access

There is **no default administrator or password**. Supply `ADMIN_PASSWORD` through a private environment/secret mechanism, then provision an account explicitly:

```bash
npm run admin -- --email administrator@example.com
# Built runtime / Docker, where development dependencies are absent:
npm run admin:production -- --email administrator@example.com
```

Passwords require at least 12 characters. Existing accounts are not overwritten without `--update-existing`. The admin UI is at `/AdminDashboard` (also `/admin/`). Never commit credentials or include them in shared screenshots or receipts.

## Docker and Google hosting

The non-root Node 24 image contains the built React app, compiled Node server/CLI, public seed, and retained static assets. `docker compose up --build -d` provides PostgreSQL and a persistent media/email volume after `.env` sets `SESSION_SECRET`, `POSTGRES_PASSWORD`, and an `APP_ORIGIN` matching the published address (Compose defaults to host port 8080).

For Cloud Run, use external PostgreSQL and a private Google Cloud Storage bucket. Never rely on the ephemeral container filesystem for persistent SQLite, images, or reset mail. See [operations](docs/operations.md) and [AI Studio workflow](docs/ai-studio.md). Packaging readiness is **not** evidence of a cloud deployment or AI Studio import.

## Configuration-dependent features

- **Google sign-in:** implemented with state, PKCE, verified ID token audience/issuer, nonce, and explicit authenticated account linking. Disabled honestly until Google OAuth client credentials and callback are configured. An email match never silently links an existing account.
- **Email:** password resets are written to private files by default. No outbound email is sent unless an operator explicitly configures `SMTP_URL`; contact messages are queued in the database, not emailed.
- **Photos:** local safe storage or a private GCS adapter. Uploaded JPEG/PNG/WebP files are decoded, size-bounded, stripped/reencoded as JPEG, and bound to their uploading session/account.
- **Card scanning:** optional OCR is unavailable in this branch; the UI offers manual entry. No external recognition service is contacted.
- **Website metadata:** administrator-only, bounded public HTTP(S) metadata extraction with private-network/redirect protection and DNS-pinned requests. Every draft requires manual review and category choice.

## Project layout

| Path      | Purpose                                                                  |
| --------- | ------------------------------------------------------------------------ |
| `client/` | React pages, components, account and moderation UI                       |
| `server/` | Express API, database migrations, auth, import/export, storage and tests |
| `shared/` | API contract and TypeScript types                                        |
| `data/`   | Preserved source seed and asset manifest (unchanged) plus `client-updates.json` overlay |
| `static/` | Retained source visual assets/styles/fonts                               |
| `qa/`     | Independent acceptance harness and QA documentation                      |

[Documentation map](docs/README.md) · [Client / developer handoff](docs/client-handoff.md) · [Roadmap to live](docs/roadmap-to-live.md) · [Operations](docs/operations.md) · [Backend architecture](docs/backend.md) · [API contract](shared/API_CONTRACT.md) · [Agent guide](AGENTS.md)

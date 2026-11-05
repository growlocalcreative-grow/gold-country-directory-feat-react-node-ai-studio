# Client / developer handoff

Source review date: **2026-11-05**. This guide describes the React/Node feature branch, not the preserved Django `main` branch. See the [migration review](migration-review.md) for dated test evidence and its limitations.

## What is being handed over

This is a **componentized, single-client directory application**, with readable source, a locked dependency tree, documented API, database migrations, import/export commands, a non-root Docker build, and behavioral acceptance checks. It is not a no-code theme, a multi-tenant platform, or a fully parameterized white-label product. A different client's branding, legal copy, seed data, and business rules require deliberate source/configuration changes and review.

| Layer | Reusable implementation / boundary |
| --- | --- |
| UI | React/TypeScript pages share navigation, footer, cards, search, form controls, loading/error states, and authorization presentation in `client/src/components.tsx`. `client/src/App.tsx` owns routes and legacy aliases. |
| Browser/API | `client/src/api.tsx` owns session loading, typed requests, CSRF handling, and favorite updates. `shared/types.ts` and [API contract](../shared/API_CONTRACT.md) define the boundary. |
| Server | `server/app.ts` owns HTTP routes; `domain.ts`, `auth.ts`, `validation.ts`, `storage.ts`, `email.ts`, and `website.ts` separate domain/auth/input/storage/provider concerns. Server authorization is authoritative. |
| Persistence | Knex migrations and persistent database sessions support PostgreSQL; SQLite is the local/single-instance fallback. Public import/export never migrates account ownership or passwords. |
| Delivery | Vite builds the client; TypeScript compiles the server; one Express origin serves both. Docker has build-only native compilation tools and a Node-only runtime. |

The code is intentionally a straightforward application, not a generic framework: some route/domain modules remain large, and database boundaries are not exhaustively statically typed. Type checking and automated tests provide evidence, not a guarantee of zero defects or a comprehensive security/accessibility/performance audit.

Global success notices are temporary: they survive an action's specified redirect, then disappear after eight seconds or on subsequent navigation/dismissal. Error notices require dismissal or navigation. These messages are not persisted in account data.

## Install, run, and verify

From the repository root, use Node.js 24 LTS and npm. The package engine accepts Node `>=22.12`; the supplied Docker image pins the Node 24 major line.

```bash
npm ci
cp .env.example .env
# Set a unique, stable SESSION_SECRET of at least 32 characters in private .env.
npm run dev
```

Open `http://localhost:3000`. Development uses one Express/Vite process and, by default, applies migrations and imports the public seed idempotently. `.env` is loaded by the server and CLI. SQLite, uploads, and development reset-mail files use ignored `var/` by default. To use PostgreSQL, set `DATABASE_URL` before startup; use a dedicated development database.

```bash
npm run typecheck
npm test
npm run build
# Single-instance local production-mode preview only:
NODE_ENV=production AUTO_MIGRATE=true AUTO_SEED=true npm start
```

`npm start` serves the compiled application only when `NODE_ENV=production`; do not publish Vite development middleware as production hosting. The production-mode preview above still requires the configured `.env`. [Independent QA](../qa/README.md) documents isolated SQLite/PostgreSQL, mocked OAuth, claim-concurrency, and browser checks. Their prerequisites and fixture isolation matter; never point a test harness at client production data.

## Database and administrator commands

Run migrations before seeding or creating an administrator. Seeding imports the preserved snapshot and then applies the client overlay in `data/client-updates.json` (see the [roadmap](roadmap-to-live.md#the-client-overlay-dataclient-updatesjson)). Development commands:

```bash
npm run db:migrate
npm run db:seed
# Supply ADMIN_PASSWORD privately through the environment; minimum 12 characters.
npm run admin -- --email administrator@example.com
npm run export -- ./public-directory.json
npm run import -- ./public-directory.json --dry-run
npm run import -- ./public-directory.json
```

There is no default administrator/password. `/AdminDashboard` (or `/admin/`) is the staff interface. Administrator provisioning refuses to overwrite an existing account unless `--update-existing` is explicitly supplied; that option resets its password and grants staff access. Import similarly skips existing source records unless its separate `--update-existing` flag is deliberately supplied. Public export is **not a full database backup**.

After `npm run build`, the runtime image omits development dependencies. Use the compiled CLI:

```bash
node dist/server/cli.js migrate
node dist/server/cli.js seed
npm run admin:production -- --email administrator@example.com
node dist/server/cli.js export ./public-directory.json
node dist/server/cli.js import ./public-directory.json --dry-run
node dist/server/cli.js import ./public-directory.json
node dist/server/cli.js prune-sessions
```

Supply the same intended database/environment to every command. `prune-sessions` removes expired sessions/reset tokens; it does not establish a recurring maintenance schedule.

## Configuration inventory

Use [.env.example](../.env.example) and [server/config.ts](../server/config.ts) as the authoritative names. Secrets belong in private environment/secret storage, never in client code or `VITE_*` values.

| Names | Purpose |
| --- | --- |
| `NODE_ENV`, `PORT`, `APP_ORIGIN` | Runtime mode, listening port, exact browser origin. `PUBLIC_URL` is a fallback alias if `APP_ORIGIN` is absent; prefer the explicit documented setting. |
| `SESSION_SECRET`, `COOKIE_SECURE`, `TRUST_PROXY`, `TRUSTED_ORIGINS` | Stable session key, secure-cookie switch, actual trusted proxy-hop count, and optional exact additional browser origins. |
| `DATABASE_URL`, `SQLITE_PATH` | PostgreSQL connection or SQLite path when `DATABASE_URL` is empty. |
| `AUTO_MIGRATE`, `AUTO_SEED` | Startup migration/seed switches; disable both for multi-instance production and use a release job. |
| `MEDIA_ROOT`, `GCS_BUCKET`, `GCS_PREFIX` | Local upload storage or private GCS storage through runtime Application Default Credentials. |
| `SMTP_URL`, `SMTP_FROM`, `EMAIL_FILE_PATH` | Explicit SMTP delivery or private file-only password-reset mail when SMTP is unset. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in enablement; callback is `<APP_ORIGIN>/api/auth/google/callback`. |
| `PREVIEW_MODE`, `PREVIEW_FRAME_ANCESTORS` | Preview noindex behavior and optional exact embedding origins. Preview mode is not authentication and defaults on. |
| `ADMIN_PASSWORD` | CLI-only administrator provisioning secret. |
| `POSTGRES_PASSWORD`, `HOST_PORT` | Compose database password and loopback published port, default 8080. |

There is **no OCR enablement environment variable or scanner implementation** in this branch. `/api/session` reports `features.ocr: false`; desktop/mobile navigation hides Scan Card while that flag is false or unavailable. Existing direct scan links retain the explicit manual-entry fallback. Changing a flag alone would not implement recognition.

## Where to customize

| Surface | Source |
| --- | --- |
| Navigation, footer, common cards/controls, page metadata | `client/src/components.tsx` |
| Brand/login/signup copy and account screens | `client/src/account.tsx`; browser shell in `index.html` |
| Home/directory/detail content and layout | `client/src/public.tsx` |
| About/contact/legal content | `client/src/info.tsx`, `client/content/privacy.html` |
| Palette, spacing, typography, responsive layout | `static/css/site.css`, `static/css/fonts.css`, `client/src/react.css` |
| Preserved business/category records and visual assets | `data/public-seed.json`, `data/source-assets.json`, `static/source-assets/` (unchanged); client corrections in `data/client-updates.json` with images in `static/images/` |
| Password-reset email wording | `server/email.ts` |
| Moderation, claims, validation, import rules | `server/app.ts`, `server/domain.ts`, `server/validation.ts`; update the API contract and affected acceptance checks together |

Keep the original source snapshot/assets intact for this client. Replacing seed files does not rewrite existing database records automatically: perform a reviewed import with a backup, dry-run, and explicit update policy. Branding is not centralized in one config object, so a new client requires checking all listed surfaces, not just changing a logo.

## Readiness and remaining acceptance

The [dated migration review](migration-review.md) records the completed build, backend, real isolated PostgreSQL, protected browser, source-preservation, and restart checks. Those results belong to the source/runtime tested at that time; later changes require relevant verification. They establish a functional developer-review package, not a public deployment or owner acceptance.

| Item | Handoff state / remaining work |
| --- | --- |
| Public directory and local accounts/admin | Implemented, with persistent submissions, favorites, reviews, claims, and moderation. Client should accept the real workflows and permission rules. |
| Verified badge / ownership | Imported `claim_status: "approved"` preserves the source badge; approved local ownership also displays it. Neither listing publication approval nor an imported badge grants local account ownership. Client must define and accept the independent ownership-verification procedure and any account migration; the required export and the `import-accounts` command to build are specified in [roadmap stage 6](roadmap-to-live.md#6-accounts-and-listing-ownership). |
| Google sign-in | Implemented and protocol-tested with mocks. Operator-owned credentials, exact callback/consent configuration, and a live round trip remain required; steps in [roadmap stage 4](roadmap-to-live.md#4-google-sign-in). |
| Password-reset email | Local file delivery works; actual SMTP credentials, approved sender/delivery setup, and real delivery verification remain required for customer use; steps in [roadmap stage 2](roadmap-to-live.md#2-smtp-password-reset-mail). Contact messages remain database-only. |
| Media on cloud hosting | GCS adapter exists; actual bucket/IAM/credentials and authenticated read/write verification remain required; steps in [roadmap stage 3](roadmap-to-live.md#3-cloud-storage-for-uploaded-photos). Local disk is unsuitable for ephemeral Cloud Run persistence. |
| Optional card recognition | Not implemented. Hidden from navigation while unavailable; manual submission remains supported. |
| Production operations | Hosting/domain/HTTPS, production database/storage, backups and an isolated restore exercise, monitoring, secrets, and ingress/rate-limit configuration belong to the release runbook. Current API rate limits are per process, not globally distributed across replicas. |
| AI Studio / Cloud Run | Import, live builder compatibility, resources, and deployment are not verified by local packaging. No automatic GitHub mirror or Google resources are created. |
| Content / rendering | Preserved source copy and privacy policy need client approval against the final services/policies. SPA metadata updates on navigation; listing-specific server-rendered SEO/social previews are not implemented. |

For a local Compose review, configure `.env` including `APP_ORIGIN=http://localhost:8080`, `SESSION_SECRET`, and `POSTGRES_PASSWORD`, then run `docker compose up --build -d`. This publishes only to loopback and persists database/media in named volumes; do not remove those volumes during routine replacement.

For deployment, release/rollback, backups, session retention, health checks, and Cloud Run settings, follow [operations](operations.md). Preserve the database, media, and stable session secret across image changes; `/healthz` verifies a database read. Do not confuse the public export with private account/queue backups or treat a healthy container as completed client acceptance.

Further references: [documentation map](README.md), [roadmap to live](roadmap-to-live.md), [backend architecture](backend.md), [client architecture](../client/README.md), [open business/migration questions](developer-questions.md), [AI Studio workflow](ai-studio.md), [acceptance matrix](../qa/ACCEPTANCE-MATRIX.md), and the [agent guide](../AGENTS.md) for AI-assisted maintenance.

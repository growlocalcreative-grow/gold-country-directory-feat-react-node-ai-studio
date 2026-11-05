# Agent guide

Instructions for an AI coding agent (or a developer in a hurry) working in this repository. Human-facing documentation is indexed in [docs/README.md](docs/README.md); read the [client handoff](docs/client-handoff.md) and the [roadmap to live](docs/roadmap-to-live.md) before changing behavior.

## What this is

A single-client community business directory: React 19 + TypeScript client, Express 5 + TypeScript server, Knex with PostgreSQL (SQLite locally). One Express origin serves the API under `/api` and the built client. No Python, Django, Gemini, or Base44 dependency.

| Path | Contents |
| --- | --- |
| `client/src/` | Pages, components, account and admin UI |
| `server/` | `app.ts` routes, `domain.ts` import/export and views, `auth.ts`, `validation.ts`, `storage.ts`, `email.ts`, `website.ts`, `db.ts` migrations, `cli.ts` |
| `shared/` | `types.ts` and `API_CONTRACT.md`; update both with any route change |
| `data/` | `public-seed.json` (preserved, do not edit), `client-updates.json` (client overlay), `source-assets.json` (asset manifest) |
| `static/` | `source-assets/` (preserved, do not edit), `images/` (client-maintained), CSS, fonts |
| `qa/` | Independent acceptance harness |

## Commands

Use Node 24 LTS (engine `>=22.12`) and `npm ci`. Copy `.env.example` to `.env` and set a 32+ character `SESSION_SECRET`.

```bash
npm run dev          # one Express + Vite process on :3000; migrates and seeds automatically
npm run typecheck    # server and client TypeScript
npm test             # backend acceptance tests on temporary SQLite databases
npm run build        # Vite client + compiled server
npm run format       # Prettier over server, shared, client
npm run db:migrate && npm run db:seed
npm run admin -- --email administrator@example.com   # ADMIN_PASSWORD from the environment
npm run export -- ./public-directory.json
npm run import -- ./public-directory.json --dry-run
```

Run `npm run typecheck` and `npm test` before declaring any change done. The QA harness in `qa/` needs its own fixtures; see `qa/README.md`.

## Invariants (do not break)

1. **Preserved snapshot.** Never modify `data/public-seed.json` or anything in `static/source-assets/`; tests and the dated evidence depend on their hashes. Put client corrections in `data/client-updates.json` and new images in `static/images/`. The overlay re-applies a record only when it differs from what was last imported.
2. **Counts the tests pin.** The seed materializes 342 businesses, 87 categories (73 original + 14 referenced), 1 review. The overlay must not add businesses or categories; it may only update existing source IDs.
3. **Public data only in import/export.** `importData` and `exportPublic` never touch users, passwords, `owner_id`, claims, favorites, or private queues. An imported `claim_status` is a badge, never ownership.
4. **Server authorization is authoritative.** `is_staff` comes only from the CLI. Public input schemas cannot set staff, owner, approved, premium, or verified. Claims grant nothing until staff approve them. Owners cannot be replaced by a competing claim.
5. **Authentication rules.** Google identity key is the provider subject; an email match never auto-links or signs in. Linking requires a signed-in user and `{link: true}`. Passwords are scrypt; reset tokens are hashed, single-use, one hour. Sessions live in the database and rotate on login, logout, and password change.
6. **Request safety.** Mutations need `X-CSRF-Token` from `/api/session` and an allowed `Origin`. Uploads are re-encoded to JPEG under random keys and bound to the uploading session. Website metadata extraction is staff-only and SSRF-guarded.
7. **No silent sending or provisioning.** Email goes to files unless `SMTP_URL` is set; nothing provisions Google resources. Do not add outbound calls, OCR, or AI providers without an explicit decision recorded in the docs.
8. **Secrets.** Never commit `.env`, credentials, or put secrets in `VITE_*` values, logs, test fixtures, or documentation examples.

## When you change something

- Routes or payloads: update `shared/types.ts`, `shared/API_CONTRACT.md`, and the affected tests or acceptance rows.
- Moderation, claims, validation, or import rules: `server/app.ts`, `server/domain.ts`, `server/validation.ts`; keep `qa/ACCEPTANCE-MATRIX.md` truthful.
- Brand or copy: `client/src/components.tsx`, `client/src/account.tsx`, `client/src/info.tsx`, `static/css/site.css`; see "Where to customize" in the handoff.
- Anything deployment-facing: `docs/operations.md` and `docs/roadmap-to-live.md` describe what exists; mark new work as implemented only after it is tested.

Keep documentation claims matched to tested behavior. Say what was verified and how; do not describe a live integration as working unless it was exercised with real configuration.

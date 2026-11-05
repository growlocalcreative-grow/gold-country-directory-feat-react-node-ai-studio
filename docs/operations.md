# Operations — Node/React branch

Reference for environment values and release commands. The launch order, provider setup, and account migration plan are in the [roadmap to live](roadmap-to-live.md); the full document list is in the [documentation map](README.md).

## Local development and production build

1. Use Node 24 LTS, `npm ci`, and a private `.env` copied from `.env.example`.
2. Set a unique stable `SESSION_SECRET` and `APP_ORIGIN` matching the browser URL. Use `npm run dev` (single host/port, default 3000).
3. Run `npm run typecheck`, `npm test`, and `npm run build`.
4. `npm start` serves compiled production code when `NODE_ENV=production`. Do not expose Vite development middleware as production hosting.

SQLite defaults to `var/directory.sqlite`; use `DATABASE_URL` for PostgreSQL. Public seed is imported by `npm run db:seed`, preserving existing local edits, and the client overlay `data/client-updates.json` is then applied to the source IDs it lists (only when its records differ from what was last imported). Development automatic migrations/seeding can be disabled explicitly.

## Database release commands

Development CLI scripts use tsx. The production image omits dev dependencies, so use the compiled CLI:

```bash
node dist/server/cli.js migrate
node dist/server/cli.js seed
# ADMIN_PASSWORD must already be supplied privately; nothing is echoed.
node dist/server/cli.js admin --email administrator@example.com
node dist/server/cli.js export /private-backup/public-directory.json
node dist/server/cli.js import /private-backup/public-directory.json --dry-run
node dist/server/cli.js import /private-backup/public-directory.json
node dist/server/cli.js prune-sessions
```

Import requires explicit `--update-existing` to refresh already imported public fields. Dry-run rolls back the entire operation. Do not treat public export as an account/private-queue backup. Use a PostgreSQL logical backup/snapshot and separately back up media. Test restores on an isolated database. No destructive down migration is automated.

## Docker Compose

Set `SESSION_SECRET`, a strong URL-safe (for example random hex) `POSTGRES_PASSWORD`, and `APP_ORIGIN=http://localhost:8080` in a private `.env`, then run `docker compose up --build -d`. The web process runs as nonroot and uses named volumes. The provided Compose is a single-instance development/review deployment with explicit startup migration/seed flags; it is not a claim of production deployment. `HOST_PORT` changes the loopback publishing port. Preserve named volumes when replacing containers.

The final image contains only Node production dependencies, compiled server/client, static assets and public seed. Python, make and g++ are installed only in the isolated build stage to compile native npm addons; they are not runtime requirements. `.env`, local databases, private mail files, node_modules, test artifacts and QA screenshots are excluded from Docker context by `.dockerignore`.

## Cloud Run deployment shape (operator setup required)

Cloud Run is the hosting destination; AI Studio is an optional development/import workflow. Required deployment resources are not created by this branch:

- **PostgreSQL:** Cloud SQL PostgreSQL or another reachable managed PostgreSQL instance. Supply `DATABASE_URL` using Secret Manager. Use the supported Cloud SQL connection/network path and TLS as required by that service; test connectivity from the runtime identity. Keep credentials out of the image and browser bundle.
- **Media:** step-by-step in [roadmap stage 3](roadmap-to-live.md#3-cloud-storage-for-uploaded-photos). A private GCS bucket. Set `GCS_BUCKET` and optionally `GCS_PREFIX=businesses`. Give the Cloud Run runtime service account only the required object read/create permissions on that bucket. The server uses Application Default Credentials and proxies sanitized image reads; bucket public access is unnecessary. The local adapter is not durable on Cloud Run.
- **Sessions:** stable `SESSION_SECRET` shared by all replicas; PostgreSQL sessions make local memory affinity unnecessary. Set production cookie/origin values explicitly.
- **Ingress:** `NODE_ENV=production`, platform-provided `PORT`, `APP_ORIGIN=https://your-host`, `COOKIE_SECURE=true`, `TRUST_PROXY=1` for the known single ingress proxy. If your actual proxy chain differs, set and verify its exact trusted hop count. `TRUSTED_ORIGINS` permits only enumerated additional browser origins, never wildcard or null. Public custom-domain configuration is a separate explicit deployment task.
- **Release:** `AUTO_MIGRATE=false`, `AUTO_SEED=false`; run compiled migration and seed commands in a one-off release job with the same database configuration before traffic. Knex uses a migration lock. Do not have every replica reseed or migrate on every cold start.
- **Email:** step-by-step in [roadmap stage 2](roadmap-to-live.md#2-smtp-password-reset-mail). Default reset mail is file-only for safe local review. Filesystem mail is ephemeral and not deliverable on Cloud Run; before enabling customer password reset, explicitly configure approved SMTP delivery via secrets and test it. The application does not enable any sending on its own. Contact submissions remain database-only.
- **OAuth:** step-by-step in [roadmap stage 4](roadmap-to-live.md#4-google-sign-in). Configure a Google web OAuth client with callback `https://your-host/api/auth/google/callback`, client ID and secret in environment/secrets, and consent/test users as required. A private HTTP preview may not satisfy Google callback restrictions; use an approved HTTPS review host for live testing. Keep email sign-in available.

Build the Docker image, run health/readiness and migration checks, then deploy using your reviewed Google project/region/service-account configuration. No Google project, billing, domain, service, bucket, database, credential or public deployment is provisioned by these instructions. Live integrations remain unverified until tested with their actual configuration.

## Recovery and maintenance

- Keep the same secret, database and media storage when rolling the image; swapping only the image must not destroy account data.
- `/healthz` reads the database; the Docker healthcheck probes it using `PORT`.
- `PREVIEW_MODE=true` sends noindex headers and disallows robots; it is not authentication. A private review deployment still needs the existing protected portal/ingress. For an authorized embedding Control UI, set `PREVIEW_FRAME_ANCESTORS` to its exact HTTP(S) origin(s), comma-separated, with no paths or wildcards. Only preview mode permits these CSP frame ancestors and removes the conflicting SAMEORIGIN frame header; `PREVIEW_MODE=false` always keeps self-only framing. This setting never changes CSRF request-origin checks or trusts `Origin: null`.
- Expired sessions and reset tokens can be removed with `prune-sessions` in an operator-controlled maintenance job. This repository does not create schedules.
- Unreferenced uploads are retained; clean them only after checking references and the operator's retention policy. Never delete a whole media volume as routine cleanup.
- Google/SMTP/GCS secrets must be supplied privately, rotated operationally, and never shown in logs or handoff receipts.

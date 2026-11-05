# Node backend architecture

## Stack and boundaries

Node.js 24 LTS; TypeScript; Express 5; React/Vite served by the same origin; Knex database access. PostgreSQL is the production path; better-sqlite3 is a persistent local/single-instance fallback. Dependency versions are pinned by `package-lock.json`; use `npm ci`. No Python, Django, Tesseract, Base44, Gemini, or AI Studio runtime dependency remains.

`server/index.ts` creates the database connection, optionally runs locked Knex migrations and idempotent seed import, creates the Express app, and mounts Vite middleware in development or `dist/client` in production. `/healthz` checks a database read. SIGTERM/SIGINT drain the HTTP server and database pool. `PORT` is respected and the server binds `0.0.0.0` for container ingress.

The browser never connects to the database, OAuth token endpoint, GCS credentials, or SMTP directly. All browser mutations use same-origin `/api`, JSON (or a dedicated multipart upload route), and `X-CSRF-Token` obtained from `/api/session`. See the [contract](../shared/API_CONTRACT.md).

## Persistent data

One versioned migration creates accounts, OAuth identities, sessions, reset tokens, categories, businesses, favorites, reviews, claims, request queues, uploads and moderation audit events. Knex migration locking prevents duplicate schema application. Production release jobs apply migrations once before rolling traffic; startup migrations are disabled by default in production.

- Stable `source_id` distinguishes imported IDs from local primary keys.
- Original source names (including whitespace) and metadata are retained internally. Public serializers/export never expose `source_data` or imported account/claim metadata.
- 73 original categories plus 14 categories named by businesses become 87 database categories. No business is reclassified or lost.
- Import is transactional and idempotent. Existing records are skipped unless an administrator explicitly selects update-existing. Dry-run validates and rolls back. Account ownership, passwords and private queues are never imported from public JSON.
- Export is **approved public data only**, compatible with the original public export format. Database backups are a separate private operational responsibility, not the public export button.

## Authentication and permissions

Passwords use salted scrypt. Email normalization and a database `lower(email)` unique index enforce case-insensitive uniqueness. Password reset tokens are high-entropy, hashed in the database, one-hour expiry and single-use. Password change/reset increments `auth_version`, invalidating old sessions. Login, logout and password changes regenerate session IDs and CSRF tokens.

Session cookies are HttpOnly, SameSite=Lax, and Secure on configured HTTPS origins. Session state lives in the database, not process memory; a stable `SESSION_SECRET` is required across restarts/instances. The secret must be at least 32 characters. Development without a configured secret uses an ephemeral random secret and therefore does not preserve login across restart; use `.env` for persistence. `TRUST_PROXY` is an explicit hop count, never blanket trust. Mutations require CSRF and reject disallowed Origin values, `Origin: null`, and cross-site Fetch Metadata. Logout, favorites, Google OAuth start and moderation are POST-only. An optional exact `PREVIEW_FRAME_ANCESTORS` allowlist supports authorized private Control UI embedding only when `PREVIEW_MODE=true`; non-preview responses retain self-only CSP and SAMEORIGIN. Frame ancestors do not grant API-origin/CSRF permission.

Authentication and mutation routes have per-process IP rate limits. Multiple Cloud Run instances require shared ingress/edge abuse controls or a shared limiter if this traffic model needs deployment-wide budgets; the current limiter is not represented as globally distributed.

`is_staff` is provisioned only by the CLI; public input schemas cannot grant staff, owner, approved, premium or imported-verified privileges. Owners can edit their own listing; submitting users can edit only their pending submission; approved edits by nonstaff return to pending review. Claims do not grant permissions until a staff administrator explicitly confirms independent ownership verification. Conflict-safe database updates never replace another approved owner. Ownership verification policy remains an operator decision, not an automatic identity claim.

Reviews require a signed-in non-owner, one review per account/business, rating 1–5, and moderation. Updating a review resets moderation. Request queues preserve messages without silently changing/removing/merging listings. Moderation writes an audit event.

## Google OAuth

When both Google credentials exist, a CSRF-protected POST creates short-lived server-stored state, a PKCE verifier/challenge and nonce. The callback consumes state before token exchange; maintained `google-auth-library` verifies signed ID token audience/issuer/expiry, then the application checks nonce, verified email and provider subject. Provider access/refresh tokens are not stored.

A provider subject is the identity key. A Google email matching an existing local account yields an account-link-required response, never auto-login or ownership. A user must authenticate locally and explicitly start `{link:true}` from their account. A Google subject already linked to someone else cannot be reassigned. Live Google credentials and consent flow require deployment-specific verification; local mocked identity tests are not provider certification.

## Uploads and external data

Uploads have a 5 MB request-file limit and a 20-megapixel decoding limit. Sharp accepts only JPEG, PNG and WebP, applies orientation, strips metadata and reencodes a <=2000px JPEG under an opaque UUID filename. CSRF is checked before multipart processing. Upload keys are session/account-bound and cannot be attached by another user. Local media routes use a strict key regex and never arbitrary filesystem paths. Private GCS buckets are read server-side through ADC and exposed through the same constrained media route; no service-account JSON is bundled.

Public website submissions are queued without network fetch. Administrator metadata extraction permits public HTTP(S) standard ports only, blocks credentials and nonpublic DNS results, pins DNS results into the real network connection, revalidates every redirect (maximum 3), caps HTML to 1 MB, and applies a 5-second request timeout. Extraction reads observed structured/OpenGraph metadata only; it never chooses a category or publishes. Source markup is converted to text and React escapes display fields.

## Verification

`npm test` runs meaningful backend acceptance tests against temporary isolated SQLite databases, covering import fidelity/privacy/rollback, session/CSRF/auth/reset, moderation/ownership, reviews/favorites, upload sanitation/isolation, OAuth state/linking, and SSRF validation. `qa/` supplies independent HTTP acceptance for both SQLite and a real isolated PostgreSQL instance; actual run receipts are maintained outside source in the project artifact directory. Cloud Run, live OAuth, SMTP and GCS are separate deployment checks, not implied by local tests.

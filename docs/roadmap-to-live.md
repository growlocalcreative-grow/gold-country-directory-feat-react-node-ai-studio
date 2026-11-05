# Roadmap to live

Written **2026-11-05** against the React/Node feature branch. This is the launch sequence for the handoff package: what the application already supports, what the operator must provision, and what still has to be built before the public directory, its accounts, and its integrations can move off the original platform.

Read this with [operations](operations.md) (environment values and Cloud Run shape) and [client handoff](client-handoff.md) (what is delivered and what remains). Nothing here provisions a Google project, bucket, database, mail account, or domain; every step is an explicit operator action.

## At a glance

| Stage | In the code today | Operator supplies | Still to build |
| --- | --- | --- | --- |
| 1. Hosting baseline | Docker image, Knex migrations, PostgreSQL sessions, `/healthz`, release CLI | Cloud Run service, Cloud SQL PostgreSQL, Secret Manager values, HTTPS host | Nothing |
| 2. SMTP | Password-reset mail through `SMTP_URL`; file-only fallback | Mail provider credentials, sender address, SPF/DKIM/DMARC, live test | Any other notification mail (approvals, claims, contact) |
| 3. Cloud storage | Private GCS adapter for uploaded photos through Application Default Credentials | Bucket, runtime service account IAM, copy of any pre-launch uploads | Nothing |
| 4. Google sign-in | Full OAuth code flow with PKCE, nonce, verified ID token, explicit account linking | OAuth consent screen, web client, exact redirect URI per host, live round trip | Nothing |
| 5. Fresh public data | Idempotent public import/export (CLI and admin UI), client overlay file | A current public export of the original directory at cutover | Nothing |
| 6. Accounts and ownership | Accounts, Google identities, ownership, claims, favorites tables | Private export from the original platform in the format below | `import-accounts` command and one migration |
| 7. Cutover and after | Preview mode, proxy/cookie settings, session pruning | DNS, final origin, backups, monitoring schedule | Nothing |

Stages 1 to 4 can be prepared in parallel on a staging host. Stage 6 is the only stage with new code. Stage 7 is a runbook, not code.

## 1. Hosting baseline

Follow the Cloud Run section of [operations](operations.md) first. The settings that the later stages depend on:

- `APP_ORIGIN` is the exact public origin of the host. It is embedded in password-reset links and in the Google callback URL, so each host (staging, production, a later custom domain) needs its own value and its own Google redirect URI entry.
- Production requires `SESSION_SECRET` (32+ characters), `COOKIE_SECURE=true`, `TRUST_PROXY=1` behind Cloud Run ingress, `AUTO_MIGRATE=false`, and `AUTO_SEED=false`. Migrations and seeding run once in a release job with the same environment.
- Use two environments: a private HTTPS staging host for the live checks in stages 2 to 4, then the production host. Google's redirect rules and secure cookies are not testable on a plain HTTP preview or inside an embedded Control UI frame.

Release job, run against the production database before traffic:

```bash
node dist/server/cli.js migrate
node dist/server/cli.js seed
# ADMIN_PASSWORD supplied privately (12+ characters); nothing is echoed.
node dist/server/cli.js admin --email administrator@example.com
```

`seed` imports the preserved public snapshot and then applies the client overlay described in stage 5. Both are idempotent.

## 2. SMTP (password-reset mail)

### What the application sends

Only one message exists: the password-reset email. It is plain text, sent from `SMTP_FROM`, with the subject "Reset your Gold Country Directory password" and a link of the form `APP_ORIGIN/accounts/reset/<token>/`. The token is single-use and expires after one hour. Requesting a new reset invalidates the previous token. Wording lives in `server/email.ts`.

Nothing else is emailed. Contact messages, listing approvals, claim decisions, edit/removal requests, and website submissions are stored in the database and reviewed in the admin dashboard. Reproducing the original platform's "listing approved" notification would be new code.

### Default: file-only delivery

With `SMTP_URL` empty the server writes each reset message as a private JSON file under `EMAIL_FILE_PATH` (default `var/emails/`, mode 0600) and sends nothing. That is correct for local review and for Compose, and it is also what happens on Cloud Run if SMTP is never configured, where the file is lost with the container. `/api/session` reports `features.smtp: false` in that state, and the account UI tells the user that the message went to the "configured email delivery channel" without claiming delivery.

### Configuration

`SMTP_URL` is a Nodemailer connection URL. `SMTP_FROM` must be an address the provider permits for that login; the default `directory@localhost` is not deliverable and must be replaced.

| Connection | `SMTP_URL` shape | Notes |
| --- | --- | --- |
| Implicit TLS (recommended) | `smtps://USER:PASSWORD@smtp.example.com:465` | TLS from the first byte. |
| STARTTLS | `smtp://USER:PASSWORD@smtp.example.com:587?requireTLS=true` | `requireTLS=true` refuses to send if the server does not upgrade to TLS. |
| Pooled connections | append `&pool=true` | Optional; reset volume is low. |

Rules that trip people up:

- URL-encode the username and password. `@` becomes `%40`, `:` becomes `%3A`, `/` becomes `%2F`, `#` becomes `%23`.
- Query parameters map to Nodemailer transport options (`requireTLS`, `pool`, `name`, `tls.servername`). Never set `tls.rejectUnauthorized=false` outside a throwaway test.
- Provider hostnames and ports change; confirm against the provider's current documentation. Well-known shapes at the time of writing: Google Workspace `smtp.gmail.com:465` with an app password or `smtp-relay.gmail.com:587` with relay rules; SendGrid `smtp.sendgrid.net:587` with user `apikey`; Mailgun `smtp.mailgun.org:587`; Postmark `smtp.postmarkapp.com:587`.
- Store `SMTP_URL` in Secret Manager and expose it to Cloud Run as an environment variable. It never belongs in the image, in `.env.example`, in a `VITE_*` value, or in a screenshot.

### Deliverability

The From domain decides whether the message lands. Pick a domain the operator controls (the directory's own domain is the natural choice) and publish SPF, DKIM, and DMARC for the provider you chose. A `gmail.com` From address relayed through a third-party provider fails DMARC alignment; if the sender must be a Gmail address, send through Google's own SMTP. Set a reply-to policy with the operator: the application does not read replies.

### Test procedure on staging

1. Set `SMTP_URL` and `SMTP_FROM`, redeploy, and confirm `GET /api/session` shows `features.smtp: true`.
2. Sign up a test account whose mailbox you control, sign out, and request a reset from `/accounts/password_reset/`.
3. Confirm the message arrives (check spam), open the link within the hour, set a new password, and sign in with it. Then confirm a second use of the same link is refused.
4. Repeat with a non-Google mailbox if the operator's users are not all on Gmail.
5. Check the provider's sending log for the message and for bounces.

Rollback is immediate: clear `SMTP_URL` and redeploy, and the application returns to file-only behavior without code changes. Reset requests are rate limited (30 authentication requests per 15 minutes per IP per instance), tokens are hashed at rest, and `prune-sessions` removes expired tokens.

## 3. Cloud storage for uploaded photos

### What goes in the bucket

Only photos uploaded through the application. Each upload is decoded, bounded to 20 megapixels and 5 MB, stripped of metadata, re-encoded as JPEG, and stored under `GCS_PREFIX/<32 hex>.jpg` (default prefix `businesses`). Everything else is in the container image: the 275 preserved source assets under `static/source-assets/` and the client-maintained images under `static/images/`. Those are not copied to the bucket and do not need to be.

Reads are proxied by the server through `/media/businesses/<key>` using the runtime identity, so the bucket stays private and no signed URLs or public ACLs are needed.

### Setup

1. Create a bucket in the same region as the Cloud Run service with uniform bucket-level access and public access prevention enforced. Enable object versioning if you want accidental-overwrite protection; the application never overwrites or deletes objects.
2. Grant the Cloud Run runtime service account object read and create on that bucket only (`roles/storage.objectViewer` plus `roles/storage.objectCreator`, or the broader `roles/storage.objectUser`). No service-account key file is used or bundled; the client library picks up Application Default Credentials.
3. Set `GCS_BUCKET` and, if you changed it, `GCS_PREFIX`. Leave `MEDIA_ROOT` alone; it is ignored when a bucket is set.
4. Redeploy, upload a photo from a listing form on staging, confirm the object appears under the prefix with content type `image/jpeg`, and confirm the listing renders it through `/media/businesses/...`. Confirm the object is not reachable at a public storage URL.

### Moving existing uploads

Enabling the bucket does not migrate anything. If photos were uploaded on Compose or a local run before cutover, copy the files so the keys stored in the database keep resolving:

```bash
gcloud storage cp var/media/businesses/*.jpg gs://YOUR_BUCKET/businesses/
```

The database stores the key `businesses/<hex>.jpg`; the adapter maps it to `GCS_PREFIX/<hex>.jpg`, so the destination folder must equal `GCS_PREFIX`. After copying, open a listing that had an upload and confirm the image loads. Keep the Compose `app-data` volume until that check passes.

Back up media separately from the database: a PostgreSQL dump does not include the bucket, and the public export never includes uploads.

## 4. Google sign-in

### How the implementation behaves

- `POST /api/auth/google/start` (CSRF-protected) stores a ten-minute state, PKCE verifier, and nonce in the server session, then returns Google's authorization URL with scopes `openid email profile` and `prompt=select_account`.
- `GET /api/auth/google/callback` consumes the state before the token exchange, verifies the ID token signature, audience, issuer, and expiry with `google-auth-library`, then checks the nonce, that Google reports the email as verified, and the provider subject.
- The Google **subject** (`sub`) is the identity key, stored in `oauth_accounts (provider, subject, user_id)`. Access and refresh tokens are never stored.
- A Google identity already linked signs that account in. An unlinked identity whose email matches an existing directory account is refused with `account_link_required`; the user must sign in with their password and press "Link Google account" on `/account/`, which runs the same flow with `link: true` bound to the signed-in user. An identity linked to someone else cannot be reassigned (`oauth_linked`). A new email creates a new account with no password, which can be set later through reset.
- With either credential missing, `/api/session` reports `features.google: false`, the button is disabled with an explanatory note, and the start route answers 503. Email sign-in always remains available.

### Setup in Google Cloud

1. In the Google Cloud project that will own the integration, configure the OAuth consent screen: user type External, the directory's name, support email, authorized domain of the public host, and links to the directory's `/About` and `/Privacy` pages. The requested scopes are non-sensitive, so no scope verification is needed, but the app must be moved from Testing to In production before the public can sign in (Testing limits sign-in to listed test users).
2. Create an OAuth client of type **Web application**. Add the exact origin to Authorized JavaScript origins and `APP_ORIGIN/api/auth/google/callback` to Authorized redirect URIs. The path, scheme, host, and port must match exactly; add one entry per host (staging, production, custom domain). Use separate clients for staging and production if you want independent rotation.
3. Put the client ID and secret in Secret Manager as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Redeploy.
4. Confirm `GET /api/session` shows `features.google: true`.

### Live round trip to verify

| Check | Expected |
| --- | --- |
| Sign in with a Google account that has never used the directory | Account created, landed on `/account/`, name prefilled from Google |
| Sign in with Google using the email of an existing password account | Refused with the "sign in with its password, then link" message |
| Sign in with that password, press "Link Google account", choose the same Google account | Linked; subsequent Google sign-in lands directly on `/account/` |
| Try to link a Google account that is already linked to another directory account | Refused; no change |
| Reuse a callback URL or wait more than ten minutes | Refused; start again from the sign-in page |
| Change `APP_ORIGIN` without updating the redirect URI | Google shows `redirect_uri_mismatch`; fix the client, not the code |

Callback failures surface on the sign-in page with the email fallback; the error codes are `oauth_state`, `oauth_session`, `oauth_token`, `oauth_identity`, `oauth_linked`, `account_link_required`, `inactive_account`, and `google_unconfigured`.

## 5. Fresh public directory data

The bundled seed is a public capture from **2026-11-05**. By launch the original directory will have changed, so plan one refresh at cutover.

### Getting a current export

Either obtain an owner-side export from the original platform and convert it to the format below, or re-run the public capture process used for the audit (it lives in the private audit artifacts, not in this repository). The capture must keep original IDs, because every later import matches on them.

### Importing

```bash
node dist/server/cli.js import ./fresh-export.json --dry-run
node dist/server/cli.js import ./fresh-export.json --update-existing
```

Administrators can also use "Import directory data" on `/AdminDashboard`, which calls the same importer. Rules:

- Records are matched by source ID. Without `--update-existing` an existing record is skipped, so a refresh of already-imported listings needs that flag.
- `--update-existing` overwrites the public fields of every matching record, including fields an administrator edited locally. Do the refresh before local editing starts, or take a database snapshot and diff first.
- The whole import is one transaction; `--dry-run` validates and rolls back. Limit 50,000 records per operation.
- Account ownership, passwords, claims, favorites, and private queues are never read from this format.

### Public import format (`gold-country-directory-public-v1`)

A JSON object with any of the arrays `Category`, `Businesses`, `Reviews` (lower-case aliases accepted). Unknown fields are ignored. Scalars and arrays of scalars are accepted; arrays are joined with ", ". Listed public fields are also kept verbatim in a private `source_data` snapshot that is never exposed.

**Category**

| Field | Required | Notes |
| --- | --- | --- |
| `id` or `source_id` | yes | Stable, max 128 characters |
| `name` | yes | Max 150; businesses reference categories by this name |
| `image_url` | no | `https://` URL or a `/static/...` path listed below |
| `is_popular`, `is_promoted`, `popular_icon`, `popular_order`, `display_order` | no | Home-page shortcut presentation; `popular_order` defaults to 99 |

**Businesses**

| Field | Required | Notes |
| --- | --- | --- |
| `id` or `source_id` | yes | Stable, max 128 |
| `business_name` or `name` | yes | Max 250 |
| `category` | no | Category name, or an object with `name`; created if missing; defaults to "Other" |
| `services_specialties` or `description` | no | Listing description |
| `website` | no | `http(s)` URL; bare domains are made clickable; invalid values are kept in the snapshot but not linked |
| `image_url` or `display_image_url`, `premium_image_url` | no | `https://` URL, `/static/source-assets/<file>`, `/static/images/<file>`, or `/media/businesses/<32 hex>.jpg` |
| `status` | no | `approved`, `pending`, or `rejected`; anything else becomes `pending` |
| `claim_status` | no | Imported badge only. `approved` shows Verified; it never grants account ownership |
| `is_premium`, `is_featured`, `sort_order` | no | Presentation flags; `sort_order` numeric |
| `created_date` or `created_at` | no | ISO date; defaults to import time |
| `contact_person`, `phones`, `city`, `address`, `address_street`, `address_unit`, `address_state`, `address_zip`, `license`, `email`, `special_offers`, `last_verified_date` | no | Text |

**Reviews**

| Field | Required | Notes |
| --- | --- | --- |
| `id` or `source_id` | yes | Stable, max 128 |
| `business_id` | yes | The business's source ID; must exist in this file or the database |
| `rating` | yes | Integer 1 to 5 |
| `comment` or `body`, `reviewer_name` or `display_name` | no | Name defaults to "Community member" |
| `status` | no | Omitted means `approved`; an unrecognized value becomes `pending` |
| `created_date` or `created_at` | no | ISO date |

`export` and the admin "Export directory data" button produce this same format from approved records, so a round trip is lossless for public data.

### The client overlay (`data/client-updates.json`)

The preserved snapshot `data/public-seed.json` stays byte-for-byte unchanged so the dated preservation evidence remains valid. Corrections the client wants baked into every fresh database go in `data/client-updates.json`, in the same public format. `seed` applies it after the base seed with these rules:

- Records are matched by source ID. A record is applied only when its public fields differ from what was last imported for that ID, so an administrator's later edits to a listing survive seed runs until the overlay record itself changes.
- Referenced images belong in `static/images/`; `static/source-assets/` stays reserved for the preserved originals.
- The overlay currently updates one listing, Cold Start Lab, with its current description, contact email, and brand image.

Use it for the client's own corrections. Use the import command, not the overlay, for bulk refreshes from the original platform.

## 6. Accounts and listing ownership

### Where the application stands

No account data is imported today. The `users`, `oauth_accounts`, `claims`, and `favorites` tables start empty apart from the administrator created by the CLI. Ownership (`businesses.owner_id`) is granted only when a staff member approves a claim after independent verification. Imported `claim_status: "approved"` shows the Verified badge but gives nobody edit rights.

Original passwords cannot be migrated: the application verifies scrypt hashes it created itself, and importing another platform's hashes or sessions is neither supported nor safe. Every migrated user therefore signs in for the first time through Google or through a password reset.

### What to request from the original platform

A **private** export (never committed, never passed through the public import) containing:

| Entity | Fields needed | Why |
| --- | --- | --- |
| Users | stable id, email, whether the email was verified, first and last name, created date, active flag, admin flag, and each linked identity's provider and **Google subject ID** (`sub`) | Creates the account and, with the subject, relinks Google without any user action |
| Ownership | business source id, user id, status (`approved`, `pending`, `rejected`), decided date, decided by, evidence text | Sets `owner_id` and keeps claim history |
| Favorites | user id, business source id | Restores saved listings |
| Reviews | review source id, user id | Re-attaches the one-review-per-account rule to imported reviews |
| Pending submissions | business source id, user id | Lets the original submitter edit a still-pending listing |

Do not request or accept password hashes, session tokens, OAuth refresh tokens, or payment data. If the platform cannot export the Google subject, say so early; it decides the relinking path below.

### Proposed import file (`gold-country-directory-accounts-v1`)

```json
{
  "format": "gold-country-directory-accounts-v1",
  "exported_at": "2026-12-01T00:00:00Z",
  "users": [
    {
      "id": "orig-user-123",
      "email": "owner@example.com",
      "email_verified": true,
      "first_name": "Pat",
      "last_name": "Owner",
      "created_at": "2026-02-20T18:00:00Z",
      "is_active": true,
      "is_admin": false,
      "identities": [{ "provider": "google", "subject": "109876543210987654321" }]
    }
  ],
  "ownership": [
    {
      "business_id": "69a14ac00c472525c8f82f57",
      "user_id": "orig-user-123",
      "status": "approved",
      "decided_at": "2026-03-01T00:00:00Z",
      "decided_by": "orig-admin-1",
      "evidence": ""
    }
  ],
  "favorites": [{ "user_id": "orig-user-123", "business_id": "699798d2e19ca9d655f86f69" }],
  "reviews": [{ "id": "orig-review-9", "user_id": "orig-user-123" }],
  "submissions": [{ "business_id": "local-pending-1", "user_id": "orig-user-123" }]
}
```

### The command to build: `import-accounts`

Scope for the developer who takes this on:

1. One migration adding a nullable unique `users.source_id` so re-runs are idempotent, plus the same on `claims` if claim history should carry an original id.
2. `node dist/server/cli.js import-accounts FILE [--dry-run]`, transactional like the public importer, with a report of created, linked, skipped, and conflicting rows and an `audit_events` entry.
3. Behavior rules: create users with `password_hash` null (sign-in only via Google or reset); normalize emails to lower case; never create sessions; never set `is_staff` from the file unless an explicit `--grant-admin` flag is passed; insert `oauth_accounts` rows for provided subjects unless the subject is already linked elsewhere (report, do not reassign); set `owner_id` only for `approved` ownership rows whose business exists and has no different owner (report conflicts); write `claims` rows for every ownership row so history is visible in the admin dashboard; restore favorites and review `user_id` where both sides exist.
4. Conflict policy: an email that already exists as a locally registered account is reported and left alone. Merging accounts is a manual support task; there is no merge tool.
5. Tests in `server/backend.test.ts` for idempotency, conflict reporting, and that the command grants nothing beyond the file's approved ownership rows.

### Relinking paths for existing users

| Situation | What happens | What the user does |
| --- | --- | --- |
| Export includes the Google subject | `oauth_accounts` row created at import | Presses "Continue with Google" and is signed in |
| Export has email only, user had a password on the old platform | Account created without a password | Requests a reset from the sign-in page (needs SMTP), sets a password, signs in, optionally links Google from `/account/` |
| Export has email only, user signs in with Google first | Refused with `account_link_required` because the email already exists | Follows the reset path above, then links Google |
| User's Google email differs from the exported email | Google creates a separate new account | Support asks the user to reset the original account instead, or the owner re-claims the listing |
| User is not in the export | Starts fresh | Signs up and claims the listing; staff verify ownership |

Without SMTP, only the Google-subject path is self-service. Plan SMTP before account import unless every owner will be relinked by subject.

There is no bulk invitation sender. Users request their own reset, or a later `invite` command can send reset links in batches once the operator has approved the message wording and sender.

### Policy still owned by the operator

How ownership is verified before a claim is approved remains undecided (see [developer questions](developer-questions.md), item 1). The import above preserves what the original platform decided; it does not define how new claims are judged.

## 7. Cutover sequence

1. **Announce and freeze.** Tell listing owners the date; stop accepting edits on the original platform.
2. **Provision production.** Cloud SQL, bucket and IAM, Secret Manager values, production OAuth client with the final host's redirect URI, SMTP credentials. Deploy the image with `AUTO_MIGRATE=false` and `AUTO_SEED=false`.
3. **Release job.** `migrate`, `seed`, `admin --email ...` against the production database.
4. **Fresh public data.** Export from the original platform, `import --dry-run`, then `import --update-existing`.
5. **Accounts.** `import-accounts --dry-run`, review the report, then run it for real. Take a database snapshot first.
6. **Uploads.** Copy any pre-launch uploads to the bucket (stage 3).
7. **Smoke test on the production host before DNS changes:** `/healthz`; `/api/session` shows `features.google: true` and `features.smtp: true`; a Google round trip; a reset email received; a photo upload; each admin queue opens; a listing's Verified badge and owner edit rights match the import report.
8. **Go public.** Point DNS at the service, confirm HTTPS, set `APP_ORIGIN` to the final origin, `PREVIEW_MODE=false`, `COOKIE_SECURE=true`, `TRUST_PROXY=1`, update the Google redirect URI for the final host, redeploy, and repeat the Google and reset checks because both embed the origin.
9. **After launch.** Automated Cloud SQL backups plus bucket versioning or a scheduled copy; a Cloud Scheduler job that runs `prune-sessions`; uptime monitoring of `/healthz`; log review for `rate_limit` and `oauth_*` errors; an edge rate limit if the per-instance limiter is not enough; secret rotation dates; privacy-policy text and date updated for the new services.

Rollback at any step before DNS is a redeploy with the previous settings. After DNS, keep the original platform reachable read-only until the owner signs off, and keep the pre-import database snapshot.

## Launch checklist

- [ ] Production `APP_ORIGIN`, `SESSION_SECRET`, `COOKIE_SECURE`, `TRUST_PROXY` set; `AUTO_*` false
- [ ] Cloud SQL reachable from the runtime identity; migrations applied by the release job
- [ ] Administrator provisioned; no shared or default password
- [ ] `SMTP_URL` and `SMTP_FROM` set; SPF/DKIM/DMARC published; reset email received and used on staging and production
- [ ] `GCS_BUCKET` set; IAM limited to that bucket; upload and read verified; pre-launch uploads copied
- [ ] OAuth consent screen in production; redirect URI matches the final host; all six checks in stage 4 pass
- [ ] Fresh public export imported; counts reviewed against the original directory
- [ ] Account export received, `import-accounts` built and tested, dry-run report reviewed, real import done, snapshot kept
- [ ] Owners told how to sign in (Google or reset) and how to claim if missing
- [ ] `PREVIEW_MODE=false`; robots and page metadata reviewed
- [ ] Backups, session pruning, monitoring, and rotation dates scheduled
- [ ] Privacy and contact pages reviewed by the owner

## Decisions the owner still needs to make

- Ownership verification procedure for new claims ([developer questions](developer-questions.md), item 1).
- Which events, if any, should send email beyond password reset, and the sender identity for them (item 4).
- Whether the original platform can export Google subject IDs; this picks the relinking path in stage 6.
- The final hostname and the Google Cloud project that owns the OAuth client, bucket, and database.

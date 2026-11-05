# React/Node independent acceptance

Scope: local React/Node port and new private review surface only. Original Django source, live preview and user data remain read-only. Fixtures use isolated SQLite/PostgreSQL databases and newly generated ordinary/staff accounts. No live OAuth, external mail, cloud provisioning or production deployment is inferred.

Derived from the original `directory/models.py`, `views.py`, `forms.py`, `tests.py`, import/export commands and public templates on 2026-11-05. API/UI shape may change; the behavior below must not silently change.

| Area | Required independent evidence |
|---|---|
| Preserved source | Original sanitized seed byte hash and all 275 source assets unchanged; 342 businesses, 73 original categories plus 14 supplemental, one review, original source IDs retained. The client overlay `data/client-updates.json` updates only existing source IDs, creates no businesses or categories, and leaves later local edits alone until its own records change. |
| Public browsing | Home, directory, source detail aliases, search, category/location filtering, ordering and favorites; pending/rejected listings/reviews hidden even with guessed IDs. |
| Sessions | Ordinary signup only, case-insensitive unique email/login, no plaintext password/token leaks, HttpOnly cookie, CSRF and wrong-origin rejection, rotation on authentication, POST-only logout; auth survives process restart and expires on logout/password reset. |
| Moderation | Public submissions pending/unowned/nonpremium despite forged flags; pending submitter editing allowed, approved submitter-only editing denied; owner edits require reapproval; unrelated users cannot edit. |
| Claims | No privilege from claim submission or imported claimed badges; staff-only approval with explicit verification; competing claim cannot replace existing owner. |
| Reviews/favorites | Account scoped persistent favorites; moderated review, rating 1–5, one review per user/business, no owner self-review; approved review visible. |
| Requests | Contact, URL, edit/removal/merge requests stored without sending, fetching or deleting/merging business; staff-only extraction retains public-DNS/redirect/size/time protections. |
| Uploads | SVG/HTML/mislabeled/oversized images rejected; real JPEG/PNG/WebP decoded and sanitized to randomly named JPEG; no traversal, metadata retention, arbitrary extension or cross-user key theft. |
| OAuth/email | Missing Google config honest unavailable/no session; configured start uses CSRF, state, PKCE, exact callback and invalid state rejected before exchange; matching email cannot silently link account. Reset is neutral, expiring/single-use, local-only mail by default. Live providers explicitly unverified. |
| Data portability | Seed idempotent, duplicate category names/IDs preserved; local edits retained by default; explicit update only; malformed import atomic; export excludes private source snapshots, account hashes/tokens and private request evidence; round-trip does not duplicate local source IDs. |
| Admin | No default admin; explicit CLI provisioning; staff routes unavailable to normal users; sessions/private source snapshots never exposed publicly. |
| PostgreSQL | Actual isolated container migration, seed, auth/moderation/export and restart persistence; no claim based only on ORM portability. |
| Browser | Actual React UI workflows through protected delivered route; 1440/820/390px navigation, forms, filter, carousel, data-backed actions and rendered image decode; no browser errors or horizontal overflow. Screenshots are observations, not owner acceptance. |
| Operations | Startup honors PORT, health DB check, durable media and database path, Docker/source parity, no original app changes. Cloud Run guidance is not a cloud deployment receipt. |

## Harness safety

- `capture-baseline.py --source <original> --out <external artifact>` reads only tracked public source; never opens `var/`.
- Acceptance harness requires explicit isolated data directory markers; never point it at original data or the original preview.
- Keep fixture passwords, session cookies, reset/OAuth tokens and portal entry URLs out of reports and Git.
- Record the evidence timestamp and tested source fingerprint with every receipt. A later code change may require a targeted rerun; do not relabel old results as current.

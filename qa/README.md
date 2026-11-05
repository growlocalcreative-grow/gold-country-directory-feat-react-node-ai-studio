# Independent QA

These checks were written independently of the application implementation from the prior directory's acceptance behavior. See [acceptance matrix](ACCEPTANCE-MATRIX.md).

## Public-source preservation

```sh
python3 qa/capture-baseline.py --source ../gold-country-directory --out /ABSOLUTE/PRIVATE/ARTIFACTS/original-baseline.json
```

This only reads tracked source, sanitized seed and bundled assets. It never opens the old application's database or mutable data directory.

## Isolated HTTP checks

```sh
QA_ISOLATED_RUN=1 \
QA_ARTIFACT_ROOT=/ABSOLUTE/PRIVATE/ARTIFACTS/gold-country-directory-react-node/qa \
node qa/api-acceptance.mjs
```

The runner starts/stops its own loopback server and creates a fresh private SQLite directory. It records source hashes, observations and failures, without credentials/cookies/tokens. For actual PostgreSQL acceptance, add `QA_DB_ENV=/ABSOLUTE/PRIVATE/connection.env`, whose only required entry is `DATABASE_URL=...`. The database must be a **fresh, isolated**, loopback `gcd_qa` or `gcd_qa_*` database, never a production or existing preview database. The runner deliberately refuses other names/hosts. It does not wipe databases or remove volumes.

## Mocked OAuth boundaries

```sh
node --import tsx --test qa/oauth-protocol.test.ts
```

This replaces provider token exchange/identity verification with local mocks to check state, PKCE, nonce, verified-email, explicit-linking and account takeover boundaries. It is **not** real Google authentication verification and contacts no provider. Temporary SQLite test data remains in a uniquely named OS temporary directory.

## Focused claim concurrency

```sh
node --import tsx --test qa/claim-concurrency.test.ts
```

For actual PostgreSQL concurrency, supply a private `QA_DB_ENV` connection file pointing to a fresh loopback database named `gcd_qa_race_<suffix>`. This verifies simultaneous decisions on one claim and competing claims for one listing. It only creates its own fixtures; it never clears an existing database.

## Protected browser workflows

```sh
QA_ARTIFACT_ROOT=/ABSOLUTE/PRIVATE/ARTIFACTS/gold-country-directory-react-node/qa \
QA_PORTAL_FILE=/ABSOLUTE/PRIVATE/portal-private.json \
QA_BROWSER_FIXTURE=/ABSOLUTE/PRIVATE/preview-admin-private.json \
node qa/browser-acceptance.cjs
```

Portal JSON supplies `url`; fixture JSON supplies the **new isolated runtime** `admin_email` and `password`. The runner resolves `playwright` normally; if Playwright is installed separately, set `QA_PLAYWRIGHT_MODULE=/absolute/path/to/node_modules/playwright`. Playwright is a QA-tool prerequisite, not a production application dependency. The runner uses system Chrome (`QA_BROWSER_BIN` overrides the default `/usr/bin/google-chrome`). It creates uniquely identified ordinary fixture accounts and one listing through real UI forms; it rejects only that listing afterward. It does not delete arbitrary records or call external providers. The protected entry URL and fixture credentials stay out of receipts.

Screenshots and successful automated interactions establish observed behavior, not owner acceptance. Date and runtime/source fingerprints matter; rerun targeted checks after relevant changes.

After investigating a harness interruption, `QA_RESUME_DIR` can point to that run's private artifact directory. Its successful observations keep their original timestamps and recorded failed attempts remain in the receipt. Check existing fixture state before resuming; do not repeat mutations with unknown outcomes blindly.

# Public data preservation and deliberate normalization

The public seed captured on **2026-11-05** retains the observed business names, category strings, source IDs and original website field values. Imports retain an internal `source_data` snapshot of explicitly allowlisted **public fields**, preserving their original values. Creator/account identifiers, claimant contact details, reviewer email, private queues and unknown metadata are not retained in new snapshots; nested category objects use the same public-field allowlist. Published business contact fields remain public directory data. Snapshots are excluded from public API responses and exports. This note distinguishes raw public-value preservation from safe clickable display.

Every field in the bundled, already-sanitized public seed is covered by the snapshot allowlists and preservation regression. The importer does not silently rewrite existing snapshots when an idempotent import skips a record, and this code change does not migrate or delete existing runtime data. Any historical unsanitized imports need a separate inspected retention review.

## Website values

Among the source website fields that were not already complete HTTP(S) URLs:

- **39 usable bare-domain website values** become clickable `https://…` URLs in the application. Their original spelling/value remains in the seed and `source_data`.
- **4 invalid website values** are excluded from clickable website URLs, not deleted from the original data:
  - Connected Plumbing: an email address stored in the website field.
  - Derner enterprise: an email address stored in the website field.
  - Sindt Tree Services: plain business-name text stored in the website field.
  - West Capital Lending: a social handle stored in the website field.

Those four values need an authoritative correction from the owner or original developer. The recreation does not guess a website, social network, or email-field correction. “43 restored websites” would be inaccurate: 43 values were examined, 39 became safe website links, and 4 remain preserved only as original source values.

## Categories and identifiers

All **73 original category IDs** remain present, including the duplicate “Culinary Services” name. The **14 category strings found only on business records** receive supplemental local category rows with `local-<UUID>` identifiers. These are not presented as additional original category exports. Exact source category names—including observed whitespace and spelling—are retained.

New local categories, businesses and reviews also receive persistent `local-<UUID>` identifiers. Public export followed by import therefore preserves their identity rather than duplicating records. Uploaded image references use allowlisted `/media/businesses/<UUID>.jpg` paths; restoring the referenced media files is a separate backup step, because the JSON export does not contain file bytes.

See [backend design](backend.md) for import/ownership boundaries and [source audit](source-audit.md) for the observed-source record and asset inventory.

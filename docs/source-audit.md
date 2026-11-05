# Original-site audit and fidelity contract

Source: <https://goldcountrydirectory.base44.app/>. Audit: **2026-11-05, 14:36–14:49 UTC**. This is evidence about the original, not a declaration that the replacement has passed acceptance. Replacement checks belong in the delivery/test receipt.

## Method and limits

- Fresh, unauthenticated browser contexts; desktop 1440px and mobile 390px. Inspected rendered text, controls, links, images, public JavaScript/CSS, and the exact read requests made by the public Directory.
- Blocked all non-GET/HEAD/OPTIONS browser requests. No original forms, ratings, claims, removals, emails, uploads, AI extraction, payments, account creation, or original administrator operations were submitted. No credentials or original account sessions were used.
- No hidden/private API enumeration. Authenticated functionality below is identified as **client-code evidence**, not a tested original backend guarantee.
- Private-purpose metadata returned by the original public API was excluded from the portable seed: creator accounts/IDs, claimant accounts/contact fields, reviewer email, internal data-quality/duplicate flags, and internal provenance fields. Raw responses remain outside this repository in the private audit artifacts.
- Existing spelling, punctuation, category names, blank fields, and source placeholder images are preserved. Do not silently improve editorial copy or invent missing businesses/reviews.

## Public data snapshot

| Entity | Normal public request | Rows returned | Portable contents |
|---|---|---:|---|
| Businesses | `filter({status:"approved"}, "business_name", 500)` | 342 | Public listing fields and original IDs |
| Category | `list("display_order", 200)` | 73 | Name, order, image, popular/promoted flags and icon |
| Reviews | `list("-created_date", 500)` | 1 | Business ID, rating, public author name/comment, date |

These are all records returned within the original public app's normal limits. This is not a dump of the unavailable backend, accounts, pending listings, claims, or moderation history. Home separately requests the same approved businesses newest-first and the latest 100 reviews.

- Two listings are marked premium. Fifty-six display approved-claim/Verified status; 286 are unclaimed. **Imported badges do not establish account ownership in the replacement.** Source ownership must be mapped through a verified migration/admin process.
- Duplicate names exist, including `Hairstylist` (2), `Handyman` (5), `Pet Sitting` (2), and `Unknown Business` (13). Keep stable original IDs; slug-only routing must not arbitrarily select a duplicate. The exact source slug is `name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-")`: remove punctuation (AT&T → att), do not transliterate Unicode, collapse whitespace/hyphens. All 320 unique-name imported slugs were independently compared with the original function with zero mismatches; the other 22 records use the ID route.
- Fourteen exact business category strings have no matching Category row: `Architect`, `Education `, `Event Planning & Balloon Art`, `Event Venue / Planning /Services`, `Fine Art`, `Fireplace / Chimney Cleaning`, `Flooring Installation `, `Gun Shop`, `Health / Fitness / Welness`, `Land Services`, `Locksmiths`, `Manufacturing`, `Masonry`, `Specialty Gifts`. Preserve the original category string independently of an optional category relationship.
- Source description/category typos such as `Website Desgin` are original content, not reconstruction errors. No original user password, token, or session can be recovered from this audit.

## Assets and portability

All **275 referenced public image URLs** were downloaded into `static/source-assets/`: **246 SVG placeholders, 11 PNG images, 18 JPEG images**, **94,351,159 bytes** total. Original bytes were preserved; their hashes, source URLs, reference IDs, and retrieval times are in `data/source-assets.json`.

The SVGs are existing source-provided placeholder graphics, primarily from placehold.co, not newly designed replacements. All business `image_url` values are relevant because the details screen renders them, although compact directory cards omit them. Some source photographs are large (largest 23.45 MB and 18.87 MB); a later lossless/visually equivalent web-image optimization is optional, not silently part of this audit.

Validation at **14:47:02 UTC**: 275/275 local hashes match; 246/246 SVGs parse as XML with no script, event handlers, foreignObject, active embed/media tags, external references, JavaScript URLs, external CSS URLs, or DTD/entities. Runtime seed image URLs point only to `/static/source-assets/...`; source URLs in the manifest are provenance, not runtime dependencies. General logo/fonts are a separate frontend asset task.

## Route and behavior fidelity matrix

Legend: **Rendered** = original publicly observed; **Code** = behavior found in its shipped client bundle; **Unavailable** = original authenticated/backend behavior not exercised.

| Route/area | Original evidence and exact behavior to preserve | Evidence boundary |
|---|---|---|
| `/`, `/Home` | “Find Local Pros / in the Divide”; “Your community business directory”; hero search “Plumbers, restaurants, auto shops…”; “New to the Divide”; “Recently Reviewed”; “Browse All 340+ Businesses” | Rendered + Code. The 340+ label is static original copy, not a fresh measured count. |
| Home ordering | Newest approved listings, stable premium-first grouping, first 12. Recent reviews: newest review for each business, first 8 distinct businesses. | Code; one review currently rendered. |
| Home shortcuts | Emergency → `Directory?q=emergency`; Dining → `q=dining`; Home Pros → `q=home`; Local Makers → `q=makers`. These are literal text searches, not semantic taxonomy. | Rendered + Code |
| Layout | White sticky 56px header; site-name link goes to Directory; Browse, Add Your Business, Scan Card, Sign In. Search in desktop header. Mobile menu additionally exposes About and Contact. Footer About, Contact, Suggest an Edit email, Privacy Policy. | Rendered + Code |
| `/Directory` | “Explore the Divide”; popular category circles; complete category filtering/grouping; business cards; search; count/share; sorting. | Rendered + Code |
| Search | Case-insensitive substring of business name, contact person, services/specialties, city/address, or exact stored category text; optional category filter combined with search. | Code |
| Sorting | `alpha` default: “Alphabetical (A–Z)”; `newest`: “Recently Added”, descending created date; `category`: “Category”, category then name ascending. Category display order ties use name; popular circles use `popular_order` (99 fallback). | Code |
| Compact card | Category, business name, optional Verified/Premium, contact person, formatted click-to-call phone, map/location, favorite control, View Details. Premium has gold outline; claimed has green outline. Source images are not displayed here. | Rendered + Code |
| `/BusinessDetails?id=…`, `/business/:businessNameSlug` | Back to Directory; title/category/Verified; listing image; contact; Call, Text, Email, Website, Directions, Share; location; Services / Specialties; owner/claim controls; removal request; Suggest Edit; Save; Reviews. Empty fields omit the relevant controls. | Rendered + Code |
| Detail routing | Pretty slug when the name is unique; ID query route when names collide. Preserve source IDs and query routes for future data migration. | Code |
| Premium detail | If premium and populated: “Special Offers & Promotions”, rich-text special offers and featured-offer image. No public prices or checkout were found. | Code; both premium source records have limited populated data. |
| Sharing | Browser share where available; fallback copy/link/SMS interface. Directory share retains search/category parameters. | Code; no messages sent. |
| Review | Guests see “Log in to leave a review.” Client submits business ID, 1–5 rating, comment, display name and account email, then refetches reviews. | Guest rendered; successful write/moderation behavior unavailable. |
| `/MyFaves` | Guests redirect to sign-in. Signed-in client loads favorites and corresponding listings, with sort/removal controls. Favorites are account-specific. | Guest redirect rendered; signed-in behavior Code only. |
| Authentication | Original sign-in shows Continue with Google, Email, Password, Forgot password, Sign up. Signup asks Email, Password, Confirm Password. Reset asks email and “Send reset link”. Return URL preserves intended page. | Rendered forms only; no login, signup, reset or Google calls made. |
| Claim | Guest “Log in to claim this business”. Signed-in claim form requires business name, contact name, phone, contact email. Client requires email to match business's current email case-insensitively; no email on listing blocks claim. Submission sets pending claim; admin approval expected. | Guest rendered; validation and write payload Code. Email match alone is not verified ownership. |
| Owner editing | `/EditBusiness?id=…`, `/edit-business?id=…`; client permits approved claimed account or admin. Edit name/category/contact/phone/address/license/email/site/services/image; premium fields include rich-text offers and offer-image URL. | Code only; original server authorization unavailable. |
| `/SuggestBusiness` | “Add Your Business”; “Know a local business? Submit it for admin review.” Manual Form and Scan Card tabs. Name and category required; contact/phone/email/website/services/address/image and featured-interest fields optional. Address split into street/unit/city/state/ZIP, default CA, serialized into original `city`. | Rendered + Code; no submission. |
| Suggested duplicate | Client checks normalized phone/email/website against existing listings, presents possible match, then creates merge request or lets the submitter continue a separate pending listing. | Code only |
| `/SuggestBusiness?tab=scan` | Public single-card camera/file upload; extract, review/correct, then submit pending. Original calls file upload then Base44 AI with the image. | UI rendered by frontend audit; extraction not invoked. |
| `/AddByUrl` | Publicly renderable “Add by URL”; “Paste a business website — we'll draft the listing for you to review.” Website field, “Draft Listing”, “Back to Admin”. Review step before pending submission. | Rendered + Code; extraction not invoked. Intended privilege needs confirmation. |
| `/ScanCards` | Separate explicitly registered admin-only batch-card route. Upload multiple images, per-card parsing/error, pending card drafts, review/edit/dismiss. Not the public Scan Card tab. | Code only; no original admin reads/writes. |
| `/AdminDashboard` | Client includes business/category management; approve pending listings and claims; removal requests; reviews; duplicate/merge handling; featured/premium/data-quality tools; URL/card entry points. | Code only. Actual permissions, notification policy and server invariants unavailable. |
| Removal request | “Request removal of this listing” opens “Request Removal” with name/email required, optional phone/reason. Saves pending request for admin verification. | Modal rendered; write payload Code; no submission. |
| `/About`, `/Contact`, `/Privacy` | Original public copy captured. Contact email `growlocalcreative@gmail.com`; Instagram `https://instagram.com/growlocalcreative`; donation `https://venmo.com/growlocalcreative`. Privacy source dated February 21, 2026. | Rendered. Privacy infrastructure references require operator confirmation before public launch. |
| Missing/legacy route | Admin email template refers to `/UserDashboard`, but no such route is registered in the shipped router. | Code. Do not claim a working original dashboard based on that link. |

## Confirmed owner direction

On 2026-11-05 the owner confirmed: administrators approve listings; ownership-verification details remain undecided; scanning/AI is optional future work (possibly n8n/OCR/AI); retain Google sign-in. These decisions supersede open preference questions, not the need for operator-owned Google credentials or an actual external-login acceptance check.

## What is reconstructed, not recovered

The portable database schema, password/session storage, authorization rules, claim ownership migration, server-side validation, moderation state transitions, local upload management, and import tooling are reconstruction decisions. The original schema cannot be fully deduced from public frontend code. Preserve observable outcomes while enforcing authority on the server, not merely hiding buttons.

The original extraction uses Base44 `Core.InvokeLLM` with `gemini_3_flash`: URL extraction supplies internet context; card extraction supplies the uploaded file URL. Those proprietary functions and keys are **not** available. Local website metadata parsing and OCR can provide functional, editable drafts without Base44, but must not be described as equivalent AI understanding. Never invent extracted values. Provider-backed parity and outbound email/Google sign-in require owner-approved configuration; see `developer-questions.md`.

The platform “Edit with Base44” badge, analytics SDK, Base44 cookies and source authentication service are hosting-platform concerns, not business content to carry into a portable implementation.

## Evidence locations

Detailed private audit artifacts are retained at:

`/home/oddo/.openclaw/workspace-csl/artifacts/gold-country-directory-2026-11-05/source-audit/`

- `public-request-provenance.json`: exact normal public read URLs and row counts.
- `public-seed.json`, `public-seed-local.json`: sanitized display-only import data, original IDs preserved.
- `rendered-routes.json`: route text, headings, buttons, fields, links and rendered image inventory.
- `account-flows.json`: guest signup/reset/removal/claim observations. The immediate claim redirect snapshot is transitional; authoritative settled login evidence is the MyFaves route capture.
- `Home-1440.png`, `Home-390.png`, other route PNGs, and auth/removal PNGs: original screenshots.
- `source-assets.json`, `asset-validation.json`: localization and SVG/hash checks.
- `source-bundle.js`, `source-styles.css`: source-public bundle snapshots, evidence only; not used as the replacement application.
- Frontend agent's separate `visual/` captures cover category filters, public scan and additional detail examples.

Source observation ends at this dated snapshot. No original server permission audit, private data export, source administrator acceptance, or replacement deployment is implied.

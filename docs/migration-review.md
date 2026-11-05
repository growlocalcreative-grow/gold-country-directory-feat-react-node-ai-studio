# React / Node migration review

Evidence date: **2026-11-05 UTC**. This is a review checkpoint, not a public release or owner acceptance.

## Result and source status

The feature branch recreates the existing directory with **React + TypeScript** and **Express + TypeScript**. PostgreSQL is supported and independently exercised; SQLite remains the local fallback. Photos use a local adapter or the configurable private Google Cloud Storage adapter. Python/Django is not required by this branch's runtime.

The original Django `main` baseline remains `2617658ff3e4a3601ced519238694f7622196800`. The migration is isolated on `feat/react-node-ai-studio`; it is not merged into `main`.

Review the [React/Node feature branch](https://git.oddo.io/client-websites/gold-country-directory/src/branch/feat/react-node-ai-studio) independently of the preserved Django `main` branch. Commit/remote availability is tracked in the delivery receipt; this document does not imply a main-branch merge or public deployment.

Preserved unchanged: **342 businesses, 73 original source categories plus 14 supplemental categories, one original review, and all 275 source-asset files**. Original identifiers, business slugs, local image paths, navigation, grouped directory, and responsive visual styling remain. New account, favorite, submission, ownership, and moderation actions persist through the Node API; imported ownership labels never grant local editing access.

## Distinct acceptance evidence

These are separate evidence sets, **not a combined test total**:

| Evidence set                               | Observed result                                                                             | Evidence time (UTC)    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- | ---------------------- |
| Backend tests                              | 35 passed; zero failures                                                                    | 2026-11-05 16:59 audit |
| Isolated SQLite HTTP acceptance            | 32/32 groups passed                                                                         | 16:46:56–16:47:05      |
| Actual isolated PostgreSQL HTTP acceptance | 32/32 groups passed                                                                         | 16:47:12–16:47:23      |
| Mocked Google OAuth protocol               | 7 scenarios / 8 TAP tests passed; no real provider exchange                                 | 2026-11-05             |
| Protected production-container rendering   | 23/23 observations; 17 screenshots; no page errors, failed requests, or horizontal overflow | 17:02:56–17:03:15      |
| Package bytes                              | 322 packaged files byte-matched by parent verification                                      | 2026-11-05             |
| Preserved public seed / assets             | Original seed hash and all 275 asset hashes unchanged                                       | 16:50:11               |

The frontend review covered 1440/820/390px home, directory, detail, submission, and login layouts; all 14 popular-category names/order/icons; category next/previous controls; the horizontal home carousel; mobile navigation; and the explicit manual-card fallback. Parent separately inspected the desktop home, mobile detail, and mobile submission screenshots with no sampled visual issue. This does not establish exhaustive visual identity or owner acceptance.

**Protected browser workflow suite: 21/21 checkpoints passed** at 17:02:22–17:05:37Z, with zero JavaScript errors or failed requests. The suite exercised account, submission, favorite, review, claim, owner edit, and administrator moderation through the actual UI. The fictional QA listing was rejected through the administrator UI afterward; the public API still exposes the 342 original businesses and 87 categories, with no public QA listing. This remains distinct from the read-only rendering observations.

**Controlled production Docker restart: 5/5 checks passed** at 17:09:29–17:09:35Z. Only the new preview container restarted once, retaining the same image, environment, and volume. All 15 SQLite table counts/digests and preserved-source hashes were unchanged; the approved public API stayed identical; an existing protected login and favorite survived; health, root, and Home recovered. Targeted supplemental checks also passed: two actual PostgreSQL claim-race scenarios (three TAP tests) and one preview-frame/origin test. These are separate checks, not additional UI-workflow totals.

## Private review delivery

Open **Control UI → Portals → Gold Country Directory — React + Node review**. Automatic panel opening failed because the requesting Control UI was no longer connected. The protected route was browser-verified, but the owner's actual frame and acceptance remain unverified. No public Cloud Run deployment, production DNS change, or original application replacement occurred.

## Remaining environment-specific checks

- **Google OAuth:** code/protocol checks are complete; live credentials, consent, and a real round trip remain unverified. Register the new exact callback: `<APP_ORIGIN>/api/auth/google/callback`. The visible sign-in button remains disabled until configured. Existing email accounts require explicit authenticated Google linking.
- **SMTP and GCS:** adapters are implemented; actual outbound SMTP and authenticated GCS operations remain unverified. Local reset-file delivery is not live email delivery.
- **AI Studio / Cloud Run:** matching the React/Node workflow is not proof of successful import or deployment. Private Gitea source transfer and the actual builder's Node/native-dependency support still need verification. No automatic GitHub mirror was created.
- **Card recognition:** optional OCR is not implemented. The later navigation update hides Scan Card while the session reports `features.ocr: false`; direct links retain the honest manual-entry fallback. The dated rendering observations above precede this update and are not presented as its verification.
- **Ownership:** administrator approval and explicit independent verification are enforced. The original owner's detailed verification rules remain TBD.
- **Rendering:** titles/descriptions update during client navigation; listing-specific server rendering and social-preview metadata are not claimed.

## Developer handoff

Start with the [client / developer handoff](client-handoff.md), [README](../README.md), [client architecture](../client/README.md), [API contract](../shared/API_CONTRACT.md), [operations](operations.md), and [AI Studio workflow](ai-studio.md). The [acceptance matrix](../qa/ACCEPTANCE-MATRIX.md) defines behavioral checks. No default administrator credentials or secrets are provided. The feature branch can be reviewed independently while the existing Django version remains available.

## Handoff refinement — 2026-11-05 17:51 UTC

This follow-up is separate from the earlier 35-test, 21-workflow, and 23-rendering-observation evidence above; those historical results have not been relabeled as reruns.

- **Source/build checks:** fresh `npm ci`, server/client type checking, **37/37 backend tests**, and the final Docker build passed. The production-dependency npm audit reported **zero advisories at this checkpoint**; this is not a comprehensive security audit.
- **Preview replacement:** the refreshed Node review image was ready at **17:50:34Z**. All **15 database table counts and content digests** matched across the image switch with the same environment, stable session secret, and persistent volume. The original Django version was untouched.
- **Independent focused browser regression:** **20/20 checks passed** through the protected preview at **17:50:57–17:51:46Z**, with zero page errors or failed requests and ten screenshots. Both existing customer/admin email logins worked; admin management remained reachable. Scan Card was absent from desktop/mobile navigation and the submission tabs at 1440/390px, while manual submission and direct-link manual fallback remained available.
- **Notice behavior:** login confirmation survived its initial redirect, cleared on later desktop/mobile navigation or manual dismissal, and expired after eight seconds without navigation. Mocked error notices survived beyond eight seconds until dismissal/navigation. Replacing a success notice gave the new notice its own timeout. Four browser-local favorite responses exercised these cases without changing server favorites or creating any account/listing fixture.
- **Visual inspection:** the actual mobile menu, mobile manual-submission form, desktop directory after notice clearance, and persistent mocked-error screenshots were inspected. This is targeted regression evidence, not a new broad visual/accessibility audit or owner acceptance.

The [client / developer handoff](client-handoff.md) describes the reusable single-client architecture, exact setup/operations commands, customization surfaces, and remaining deployment/business-rule acceptance. Live OAuth/SMTP/GCS and public hosting remain separate checks. These documentation updates do not change the running application image.

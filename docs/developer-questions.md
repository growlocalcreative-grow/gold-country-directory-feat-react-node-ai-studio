# Questions for the original app developer / owner

Owner direction received during this work on **2026-11-05**: **administrators approve listings; ownership verification is still to be determined; scanning/AI is optional future work (possibly n8n/OCR/AI); keep Google sign-in.** The questions below preserve evidence while marking those preferences resolved.

These are the remaining product/migration decisions that public observation cannot establish. The portable public directory, local accounts, moderation and import work can proceed meanwhile; answers are not permission gates for routine implementation.

## 1. Account and listing-ownership migration

**Question:** Can you export users' stable IDs/email/display name, listing owner IDs, approved/pending claim relationships, and claim decisions? How should existing users verify ownership in the new app?

**Why it matters:** The public snapshot has 342 approved listings and 56 Verified badges, but badges do not supply a safe account migration. Passwords/sessions were not exported and should not be inferred.

**Options:** Admin-reviewed mappings plus password-reset invitations; or require all owners to re-claim. **Recommendation:** Verified export mappings with invitations only when sending is configured and approved; otherwise reviewed re-claims. This avoids regranting ownership solely because an account typed an email.

**Evidence:** Original claim UI compares contact email with business email, then sends a pending admin claim. It does not reveal the actual server verification process. No original authenticated account was accessed.

**Consequence/next step:** Mapping/invitation work follows the supplied export; public directory and new account flows do not depend on it. Never import original auth tokens or passwords into fixtures. The export fields to request, the proposed file format, the `import-accounts` command to build, and the relinking paths are specified in [roadmap stage 6](roadmap-to-live.md#6-accounts-and-listing-ownership).

## 2. AI URL drafting and card scanning — optional future capability

**Resolved:** Scanning/AI is optional, not a blocker for this first recreation. No paid provider or n8n automation is authorized merely by retaining this note.

**Future question:** If extraction is enabled later, which local OCR, n8n workflow, or AI provider should supply drafts, and which acceptance examples should it support?

**Options:** (A) Portable local metadata/OCR, no AI service dependency; (B) optional provider adapter with separately supplied credentials and approved usage limits. **Recommendation:** Ship A as the default and support B only if parity on difficult cards/websites is important.

**Evidence:** Original calls Base44 `Core.InvokeLLM`, `gemini_3_flash`; website drafting adds internet context, card scanning uploads an image. These functions are unavailable outside Base44. We did not invoke them or upload any data to the source.

**Consequence/next step:** A handles confidently readable data but will not match semantic extraction in all cases; incomplete fields remain editable/blank. B adds provider configuration, costs and evaluation work. Supply representative cards/sites and expected fields for acceptance. Also confirm whether `/AddByUrl` is intentionally public; it renders to guests but says “Back to Admin”. `/ScanCards` is explicitly admin-only, separate from the public single-card tab.

## 3. Premium, featured, verified and ordering rules

**Question:** What grants/revokes Premium and Featured status, what does Verified promise, and who may change them? Are payments/subscriptions managed elsewhere?

**Options:** Admin-only manual flags (matches what can be safely recreated); or migrate the existing external billing/entitlement rules after documentation. **Recommendation:** Manual admin control until the actual entitlement source is provided—no invented checkout or pricing.

**Evidence:** Two public listings have premium status, 56 approved claims show Verified, and source code styles certain sort-order values. No public price or checkout was found; client edit code exposes premium-related fields, which does not prove appropriate backend authorization.

**Consequence/next step:** Core presentation can match now. Supply entitlement rules and expected sample cases before automating promotion, billing, or badge removal.

## 4. Moderation and notifications

**Resolved:** Administrators approve business listings. Ownership verification rules remain undecided.

**Question:** Beyond the confirmed admin approval for listings, which owner edits, reviews, claims, merge requests and removals need approval, which admins may act, and which events should email whom?

**Options:** Explicit admin moderation with no outbound email by default; or reproduce documented existing automation once recipients/templates and sender service are confirmed. **Recommendation:** Preserve pending review for listings/claims/removals/merges, and keep outbound delivery unconfigured until the operator supplies the policy. Confirm whether reviews are immediate or moderated, and whether owner edits publish immediately.

**Evidence:** Public code creates pending listings, claims, removals and merge requests. Review client appends then refetches. Admin code contains a listing-approved email with a `/UserDashboard` URL absent from the route map. Actual server rules, delivery reliability and administrator roles are unknown.

**Consequence/next step:** Supply the intended state transitions, moderation roles, sender identity, and whether approval emails should link to the listing or a new account dashboard. Email bodies can be reviewed locally before any sending.

## 5. Data completeness and editorial fidelity

**Question:** Can you supply authoritative exports for Businesses, Category, Reviews, Favorites, merge/removal requests, and source assets, including pending/archived records and original IDs? Should known spelling/category inconsistencies remain as-is or be corrected in a separate approved cleanup?

**Options:** Preserve exact current copy and category strings; or provide an approved normalized category/correction map. **Recommendation:** Preserve current source data now, then apply explicit mappings after import—do not silently merge or rename.

**Evidence:** Public reads returned 342 approved businesses, 73 category rows and one review. Fourteen business category strings are absent from Category records; some contain trailing spaces/typos. Multiple businesses have the same name, including 13 “Unknown Business” rows. Source provides 246 placeholder SVGs among 275 images.

**Consequence/next step:** The importer should remain idempotent by original ID and preserve original data. A fuller export is needed for original account-specific favorites, hidden records, historical decisions, and missing fields. Confirm whether placeholder images should remain exact or later be replaced with approved business assets.

## 6. Public launch configuration — retain Google sign-in

**Resolved:** Google sign-in must remain. Integration is part of the replacement; live credentials and an authorized redirect hostname are still required for real Google-account verification.

**Question:** Which hostname, operator legal name/contact, email service, and Google OAuth application should the portable site use, and do the existing contact/donation links remain correct?

**Next step:** Supply operator-owned Google OAuth client credentials and the authorized redirect hostname. Keep email/password as the independent fallback; test the configured OAuth protocol without claiming a successful real Google login before credentials are available. Outbound email still needs supplied settings and reviewed privacy copy.

**Evidence:** Original login offers Google, email/password and reset; public contact is `growlocalcreative@gmail.com`, Instagram and Venmo are `growlocalcreative`. Original privacy copy is dated February 21, 2026 and describes the old service. No live reset message, Google login, donation or outbound contact was sent.

**Consequence/next step:** Confirm original contact links, production hostname, privacy details and sending behavior before public release. A local mail outbox/test backend is evidence of application behavior, not delivery to real users. Hosting can remain portable and deployment-independent while these settings are unresolved.

# React client

The directory UI is a React + TypeScript single-page application. It keeps the original public routes, content, palette, spacing, local fonts, category shortcuts, and business-card layout. There is no Django template, Python, Base44 SDK, or browser-storage database dependency at runtime.

## Development

Run `npm run dev` at the repository root. Express serves the API and embeds Vite on the same port, so the client always uses same-origin `/api` requests. `npm run build` makes the production client and Node server; `npm start` serves both. Do not run a standalone Vite server without the API.

- `src/App.tsx`: route aliases, shared page layout, error boundary.
- `src/api.tsx`: typed fetch, server session, CSRF token, persistent-favorite updates.
- `src/components.tsx`: source-faithful cards/navigation/form controls and page metadata.
- `src/public.tsx`: home, category-group directory, search/sort, detail/reviews.
- `src/forms.tsx`: listing submission/edit, uploads, duplicate confirmation, ownership and edit/removal/merge requests, URL suggestions, manual card fallback.
- `src/account.tsx`: email/Google sign-in, signup, password reset/change, user dashboard.
- `src/admin.tsx`: permission-gated moderation queues, explicit ownership verification, import/export.
- `src/info.tsx` / `content/privacy.html`: retained informational pages. The privacy HTML is a fixed repository-owned source document, not API/user-provided HTML.
- `src/react.css`: small React-specific additions. The established visual system remains in `/static/css/site.css` and `/static/css/fonts.css`; uploaded/source image URLs remain unchanged.

The API is documented in [`../shared/API_CONTRACT.md`](../shared/API_CONTRACT.md). Domain types live in `shared/types.ts`. Mutating calls send the synchronizer token from `/api/session` in `X-CSRF-Token` and use HttpOnly server-session cookies. The browser does not store credentials, accounts, favorites, or moderation state in `localStorage`. Server authorization is authoritative; route guards only control presentation.

Global notices are route-scoped: a success confirmation survives its action's specified redirect, then expires after eight seconds or clears on subsequent navigation/dismissal. Errors remain until dismissal or navigation. Replacing a notice resets its timer; notices are not persisted as account state.

## Intentional integration boundaries

- **Google sign-in** remains visible but disabled with an explanation until credentials are configured. The configured action uses a CSRF-protected POST before redirecting. Signed-in users can explicitly link Google in My Account; matching email alone does not grant access.
- **Card recognition** is optional and not implemented in this branch. Desktop/mobile navigation omits Scan Card unless the server session reports `features.ocr`; it currently reports false. Existing direct scan links can preview a local file, then explicitly send the user to the manual form. They do not claim to have recognized the card or upload it silently.
- **Maps** open through a user-clicked Google Maps link; no external map iframe loads automatically.
- **Email reset** uses the server's configured delivery channel. The UI does not expose reset tokens. Development file delivery is not a claim that live SMTP works.
- **Website extraction** is staff-only and fills a reviewable draft; normal URL suggestions are queued without fetching or publishing.
- Admin approval/claim/review actions have real server persistence. There are no default administrator credentials.

## Rendering / checks

`npx tsc -p tsconfig.client.json` checks the frontend types. `npx vite build` verifies bundling. Independent browser/HTTP acceptance lives in `qa/`; use only explicitly isolated test databases.

Titles and description metadata update on client navigation. This is a client-rendered SPA: crawler-specific server rendering, social-preview metadata per listing, and AI Studio account/import verification are not claimed. Images, source seed, and fonts are local; no analytics are included.

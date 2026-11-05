# AI Studio and Cloud Run workflow

This branch is a standalone React/TypeScript + Node/Express project. That matches the JavaScript full-stack workflow discussed for Google AI Studio, while remaining runnable with npm or Docker independently of Google tooling. It does **not** need a Gemini API key because this directory does not call Gemini.

## Current source location

The authoritative repository is private Gitea (`git.oddo.io/client-websites/gold-country-directory`); the React/Node work is on a separate feature branch. No GitHub repository or mirror is created automatically.

Google's current Build-mode documentation describes **Add files (+) → Import from GitHub** and GitHub sync. That does not establish direct private Gitea import support. If AI Studio is the ongoing editor, use an explicitly authorized GitHub source/mirror/import path after reviewing repository visibility and access, or another import mechanism that the live AI Studio UI actually supports. A clean source archive can assist manual transfer; ZIP import is not claimed tested or supported here.

## Intended editing workflow

1. Import the feature-branch source using an available and authorized AI Studio source mechanism.
2. Preserve the existing `package.json`, shared API contract and database schema. Install locked dependencies; `npm run dev` provides one Express/Vite origin on `PORT`.
3. Keep server environment values server-side. No `VITE_*` key should contain a session secret, database credential, Google client secret, SMTP password or GCS credential.
4. Validate that the actual AI Studio runtime supports this project's Node version, native dependencies (`better-sqlite3`, Sharp), background process model and requested port. The Docker image provides an independent reproducible production path if a builder environment differs.
5. Run typecheck, backend tests and independent QA after edits. Source changes do not migrate production databases automatically.
6. For deployment, use the reviewed Cloud Run package and external PostgreSQL/GCS configuration described in [operations](operations.md). AI Studio's Deploy action, if used, still requires verifying those resources/environment values; it is not a substitute for configuring persistent services.

## Acceptance boundaries

Local/build/container/isolated PostgreSQL checks are evidence for the repository package, not evidence of an AI Studio source import, Cloud Run deployment, Google OAuth consent flow, real SMTP delivery, or authenticated GCS writes. Those remain environment-specific checks. No production public deployment was performed as part of this rewrite.

Official references:

- [Google AI Studio full-stack Build mode](https://ai.google.dev/gemini-api/docs/aistudio-build-mode)
- [Deploy applications from Google AI Studio](https://ai.google.dev/gemini-api/docs/aistudio-deploying)
- [Cloud Run container runtime contract](https://cloud.google.com/run/docs/container-contract)
- [Cloud Run: connecting to Cloud SQL PostgreSQL](https://cloud.google.com/sql/docs/postgres/connect-run)

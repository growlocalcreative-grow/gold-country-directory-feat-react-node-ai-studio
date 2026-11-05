# Documentation map

Everything written for this project, grouped by who reads it and when. Dates inside each document say what state of the source it describes; the code is the final authority where they differ.

## Start here

| Read | When | What it answers |
| --- | --- | --- |
| [README](../README.md) | First | What this is, how to run it, where things live |
| [Client / developer handoff](client-handoff.md) | Accepting the delivery | What is delivered, how to verify it, what remains open |
| [Roadmap to live](roadmap-to-live.md) | Planning launch | SMTP, cloud storage, Google sign-in, data refresh, account migration, cutover order |
| [Developer questions](developer-questions.md) | Making product decisions | Decisions only the owner can make, with evidence and recommendations |

## Running and operating

| Read | What it answers |
| --- | --- |
| [Operations](operations.md) | Environment values, release commands, Compose, Cloud Run shape, recovery |
| [AI Studio and Cloud Run workflow](ai-studio.md) | Editing in Google AI Studio and what that does and does not verify |
| [Independent QA](../qa/README.md) and [acceptance matrix](../qa/ACCEPTANCE-MATRIX.md) | How to re-run the acceptance checks and what they must keep proving |

## Architecture and contracts

| Read | What it answers |
| --- | --- |
| [Backend architecture](backend.md) | Stack, persistence, authentication rules, OAuth, uploads, verification |
| [API contract](../shared/API_CONTRACT.md) | Every `/api` route, request and response shape |
| [React client](../client/README.md) | Client structure, integration boundaries, rendering checks |
| [Agent guide](../AGENTS.md) | Invariants and commands for an AI coding agent working in this repository |

## Evidence and history

| Read | What it answers |
| --- | --- |
| [Migration review](migration-review.md) | Dated test evidence for the React/Node port and its limits |
| [Original-site audit](source-audit.md) | What the original directory did, how it was observed, what was reconstructed |
| [Data preservation](data-preservation.md) | What the seed keeps verbatim and the few deliberate normalizations |

## Conventions that cross documents

- `data/public-seed.json` and `static/source-assets/` are the preserved public snapshot and stay unchanged. Client corrections go in `data/client-updates.json` with images under `static/images/`; see the overlay section of the [roadmap](roadmap-to-live.md#the-client-overlay-dataclient-updatesjson).
- Public import/export never carries accounts, passwords, ownership, or private queues. Account migration is specified in the roadmap and is not yet implemented.
- Google sign-in, SMTP, and cloud storage are implemented but inert until the operator supplies credentials; `/api/session` reports which are active.
- Secrets live in private environment or Secret Manager values, never in the repository, the browser bundle, or screenshots.

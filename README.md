# Southwest Digital App

Southwest Digital App is the private, multi-brand client platform operated by Southwest Digital Marketing, a d/b/a of Lochside LLC.

The platform is independent from every public marketing website. Bookkeeping Conroe, Southwest Digital Marketing, Contigo Accounting, and Melbourne CFO are brands inside the platform rather than owners of the platform codebase.

## Tenant model

There is one tenant level: `Brand`.

- Users have one global identity.
- Users access brands through explicit memberships.
- A brand can have multiple verified hostnames.
- The entry hostname controls the login theme and preferred active brand.
- A user may switch only among brands for which they have an active membership.
- Southwest platform roles are independent from brand roles.

See [the platform blueprint](docs/architecture/platform-blueprint.md), [authentication design](docs/architecture/authentication.md), [CRM data boundary](docs/architecture/crm-data.md), [database tenant isolation](docs/architecture/database-tenant-isolation.md), [data ownership policy](docs/architecture/data-ownership.md), [offboarding/export design](docs/architecture/offboarding-and-exports.md), [database hosting decision](docs/deployment/database-hosting.md), [database role runbook](docs/deployment/database-role-provisioning.md), [production identity configuration](docs/deployment/production-identity.md), and [cutover preflight](docs/deployment/cutover-preflight.md).

The guarded first-tenant process is documented in [initial brand seed](docs/migration/initial-brand-seed.md). Its disposable PostgreSQL rehearsal is available as `npm run test:initial-seed:windows`.

## Documentation

This file is the single project document: product context, current status, session handoff state, and pointers to everything else. Non-negotiable engineering rules and cross-project working agreements live in the global agent guidance (see below) — read that before starting work.

- `docs/SWAPP-BRIEF.md` — what the product and business are
- `docs/SWAPP-REVIEW-AND-ROADMAP.md` — priorities, launch blockers, phase gates
- `docs/IMPLEMENTATION-STATUS.md` — progress against those gates
- `docs/local-development.md` — setup, dev login, checks, scripts

## Status

Pre-launch. The offer-to-payment workflow — assessment, pricing, proposal, e-signature, and Stripe Connect payment to the firm's own connected account — is implemented and exercised by Bookkeeping Conroe. The platform is not yet open to independent customer firms: tenant isolation, subscription billing, first-run activation, and data export remain open. `docs/SWAPP-REVIEW-AND-ROADMAP.md` holds the gates.

## Current session

**Current state only.** Rewrite this section each session rather than appending to it. Historical session logs live in `docs/handoff-archive/`; durable design and reference material lives in `docs/`. If a note here would still be true in three months, it belongs in `docs/`, not here.

Updated: 2026-09-14 (America/Chicago). Machine: **ripley**.

### Cross-project handoff — 2026-10-04

The Focus Google-login investigation was performed in the separate
`~/projects/bookkeepingconroe-web` repo, not in this Southwest app. That repo
shipped PR #14 (host and platform-schema repair) and PR #16 (diagnostic Auth.js
callback logging); production deploy `6ac24fbf48fbf90008efae6a` is ready. The
remaining task is to retry one Google login, read the nested Auth.js cause from
Netlify logs, and verify Focus read/write. Do not assume this repo needs the
same code change. First inspect the two repos and decide which app owns the
login surface.

### Read first

Crews do not push, PR, or merge. Do not run `prisma migrate deploy` / `migrate dev` / `db push`. Do not send outbound SMS unless the owner named the recipient in this session.

### Repository state

- Branch: `feat/review-requests-hardening`.
- `origin/main` is `c400bb4` (PR #21, leads ship-policy wording).
- Working tree should be clean.

Local commits (oldest first):

| SHA | Message |
|---|---|
| `912ef44` | `fix(reviews): host-scope public tokens and stop lying about metrics` |
| `54fff48` | `fix(reviews): star rating first, 5 to Google, else private reasons` |

### What this branch does

Public `/r/[token]` is host-scoped like proposals. Open tracking is a client
action, not GET. Staff totals count the whole brand. Reminders have a 24h
cooldown and skip people who already responded.

The public page asks for 1–5 stars. Five opens the brand Google review URL.
One through four thanks them and asks why (Communication, Turnaround time,
Pricing, Quality of work, Something else with a text box).

### Live SMS already sent this session

Owner-authorized send to himself this session. The SMS link is production
`app.bookkeepingconroe.com` (`main`), not this branch. Do not send another SMS.

Brand Quo + Google review destination were saved onto Bookkeeping Conroe from
local env during that send.

### Health

Measured on this branch, 2026-09-14, ripley:

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm test` | 99 files / 784 tests at `912ef44`; later commit adds review tests |
| Playwright `e2e/reviews.spec.ts` | 4 passed after `54fff48` |
| Live SMS | one send, owner-authorized, arrived |

### Left for the crew

Reviewer then Tester on this branch. Report gaps. Worker only if Reviewer
finds a real bug. Do not push. Ummon ships when Tom says.

Known leftover, not this job unless Reviewer says it blocks:

- Send dialog does not attach `contactId` even when a matching Contact exists.
- Production still shows the old two-button public page until this merges.

### First commands

```bash
git status --short
git log -5 --oneline
git fetch origin
```

<!-- GLOBAL-AGENT-GUIDANCE:START -->
> **Global agent guidance:** Before starting work, read `~/.codex/AGENTS.md` (the synchronized global `AGENTS.md`) and ensure you are using the most up-to-date version. Project-specific instructions are supplemental.
<!-- GLOBAL-AGENT-GUIDANCE:END -->

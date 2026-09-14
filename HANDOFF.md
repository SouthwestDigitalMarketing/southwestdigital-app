# Coding-agent handoff

**Current state only.** Rewrite this file each session rather than appending to
it. Historical session logs live in `docs/handoff-archive/`; durable design and
reference material lives in `docs/`. If a note here would still be true in three
months, it belongs in `docs/`, not in this file.

Updated: 2026-09-14 (America/Chicago). Machine: **dalliance**.

## Read first

`AGENTS.md` is the map. Do not push unless the owner said so. Do not run
`prisma migrate deploy` / `migrate dev` / `db push`.

## Repository state

- Branch: `feat/review-requests-and-p0s`. **Do not checkout another branch.**
- `origin/main` `e5f6d7d` is an ancestor of HEAD.
- This job (P1 public-link lifecycle) is committed locally, **not pushed**.
  Reviewer then Tester. Do not start Tester from Worker.

Local commits for this job (oldest first):

| SHA | Message |
|---|---|
| `8870559` | `fix(proposals): split public link capabilities into read/select/sign/pay/receipt` |
| `7c2386f` | `fix(proposals): gate public proposal pages and APIs with one lifecycle policy` |
| `0b75b3f` | `fix(proposals): revoke public tokens and persist quote expiry on publish` |
| `8645f0b` | `test(proposals): public links deny suspended, disabled, expired, and revoked` |
| (this docs commit) | `docs: public proposal link lifecycle (capabilities, revoke, expiry write)` |

Working tree should be clean after that docs commit.

### What shipped in this job

Public proposal HTML pages and `/api/proposal/[engagementId]/*` go through
`findPublishedPublicQuote` + `quoteAllowsPublicCapability` with required
`read | select | sign | pay | receipt`. Receipt survives expiry/archive/completed
until the token is nulled or the host brand/domain is inactive. Staff “Revoke
public link” sets `publicToken: null`. Unsigned archive does the same. Publish
writes `Quote.expiresAt` from catalog deadline or snapshot urgency, else null.

### Work in progress in the working tree

None once the docs commit is in. Unpushed topic-branch commits only.

## Health baseline

Measured on this branch, 2026-09-14, dalliance:

| Check | Result |
|---|---|
| `npx vitest run` (plan file set) | 14 files, 110 tests, all passing |
| `npm test` | 97 files, 768 tests, all passing (~2.8s) |
| `npm run typecheck` | **1 pre-existing error** in `src/app/(proposal)/proposal/[token]/publicProposalHtml.test.ts` (`BrandProvider` `createElement` props require `children`). Not introduced by this job. |
| Playwright / live payment | not run |

## Left for later (not this brief)

- Hash proposal tokens at rest (needs a column).
- `revokedAt` / receipt after revoke.
- Default TTL when there is no urgency/catalog deadline.
- Dev `DEV_BRAND_SLUG` hostname fallback.
- `Quote.brand` Prisma relation (P0 tenant, migrate).
- Review-request and agreement-cancellation public links.

## Parked, needs the owner — not agent work

1. **The `firm_singleton` database row in `bookkeepingconroe-web`.** Address was
   corrected in that repo; the admin contract builder still reads a stale DB row.
2. **Off-repo listings** — Google Business Profile and the other NAP copies.
   See `docs/nap-consistency.md` in `bookkeepingconroe-web`.

## First commands for the next agent

```bash
git status --short
git log -8 --oneline
git fetch origin
```

Reviewer: diff this job against `inbox/p1-public-link-lifecycle.md` and
`reports/p1-public-link-lifecycle/plan.md`. Tester: named vitest cases, not
Playwright-against-DB, no live payment.

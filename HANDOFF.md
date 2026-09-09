# Coding-agent handoff

**Current state only.** Rewrite this file each session rather than appending to
it. Historical session logs live in `docs/handoff-archive/`; durable design and
reference material lives in `docs/`. If a note here would still be true in three
months, it belongs in `docs/`, not in this file.

Updated: 2026-09-08 (America/Chicago).

## Read first

`AGENTS.md` carries the non-negotiable rules and the map of every other
document. Read it before changing code.

Two things it does not say:

- `.claude/` is untracked, user-owned content. Do not modify it.
- Read `.local/COMPUTERS.md` for the local computer inventory. It is
  intentionally Git-ignored and must stay private.

## Push policy

**Never push without explicit user instruction.** Commit locally at every phase
boundary so work is preserved; leave the push to the user. If a phase is
finished and unpushed, say so under "Repository state" below.

Never commit `.env.local` or any secret. `AUTH_SECRET`, `ZOHO_MAIL_CLIENT_ID`,
`ZOHO_MAIL_CLIENT_SECRET`, `INTEGRATION_ENCRYPTION_KEY`, the Stripe and PayPal
keys, and the Supabase URLs are all secrets. See
`docs/deployment/environment-variables.md`.

## Repository state

> **More than one agent may be working in this directory at once.** Assume the
> working tree is shared. Do not `git checkout`, `git stash`, `git reset` or
> rebase to get a job done — those yank files out from under whoever else is
> mid-edit. To land a branch without disturbing the tree, update the ref
> directly (`git fetch . <branch>:main` fast-forwards `main` without a
> checkout); to verify or build a commit in isolation, use `git worktree add`
> with a symlinked `node_modules`. Leave uncommitted changes that are not yours
> exactly where they are.

- `main` is at `634b6e6`, **3 commits ahead of `origin/main`** (`00b7d6c`) and
  unpushed. `docs/consolidate` points at the same commit; the working tree is
  checked out on it.
- **Every other branch is merged.** `feat/saas-readiness`,
  `feature/services-step-redesign`, `feature/live-preview-tab`,
  `chore/normalize-line-endings`, `chore/add-ci`, `feature/contacts`,
  `feature/reviews` and `feature/team` are all ancestors of `main` and can be
  deleted. Older `origin/agent/*` branches are historical.
- `.gitattributes` pins `* text=auto eol=lf`, so the recurring Windows CRLF
  churn is fixed at the root.
- The bookkeeping-copy migration is committed but intentionally **not applied**
  to any database.

### Work in progress in the working tree

An agreement and payment-schedule refactor, owned by another session:

```
 M src/app/api/proposal/[engagementId]/agreement/route.ts
 M src/lib/agreements/template.ts
 M src/lib/engagements/proposalCheckout.ts
 M src/lib/quotes/proposalServices.ts
?? src/lib/quotes/paymentSchedule.ts
```

Preserve it. Do not revert, stash or commit it on someone else's behalf.

**Two unit tests fail against this working tree** — `proposalCheckout.test.ts`
("charges selected cleanup plus onboarding and defers the monthly charge") and
`proposalServices.test.ts` ("charges one-time add-ons with cleanup without
advancing the recurring bill"). Both test files are themselves unmodified, and
both suites pass at `634b6e6` in a clean worktree, so the failures belong to the
in-flight refactor rather than to any committed state. Expect them until that
work lands.

## Health baseline

Measured on `main` at `634b6e6` in a clean worktree, 2026-09-08 — not in the
shared working tree, which carries the in-flight refactor noted above:

| Check | Result |
|---|---|
| `npm run typecheck` | passes |
| `npm test` | 74 files, 583 tests, all passing (~1.4s) |
| `npm run lint` | 0 errors, 8 warnings (`<img>` LCP advisories + one unused disable directive) |
| CI | `.github/workflows/ci.yml` runs typecheck, lint and unit tests on every PR and push to `main` |

Playwright is deliberately **not** in CI: those specs drive a real dev server
against a real Supabase database and sign in as staff, so they need secrets and
a reachable DB. `npm run test:e2e` stays a local step.

## Development machine

Work moved from Windows to **`dalliance`** — an HP Envy x360 running Omarchy
4.0.2 (Arch, Hyprland/Wayland) — on 2026-09-07. On this machine:

- **No `prisma generate` EPERM lock.** That workaround was Windows-only; you do
  not need to stop the dev server to regenerate the Prisma client.
- **`npm run dev` is written for Windows.** Its `set NODE_OPTIONS=... && ...`
  prefix is `cmd` syntax; under bash it silently no-ops, so the dev server
  starts but `NODE_OPTIONS` is never applied. Worth fixing with `cross-env` if
  the larger header size ever matters.
- **Scrollbars are overlay-style**, as in headless Chromium, which hides the
  double-scrollbar class of bug. `e2e/services-step.spec.ts` injects a
  `::-webkit-scrollbar` style to force classic scrollbars.
- The `*.ps1` scripts under `scripts/` and the `test:*:windows` npm scripts
  cannot run here.
- A `next dev` server may already be listening on **:3000**.

## Known gaps worth naming

Corrected against the code on 2026-09-08 — several older "deferred" notes have
since been fixed and are dropped.

- **No `signedQuoteRevisionId`.** The exact signed revision is still not pinned,
  so receipts and signed PDFs render from current published state rather than
  the revision the client signed. See
  `docs/design/proposal-version-tracking.md`. The *payment* half of this is
  solved: `src/lib/stripe/reconcileProposalPayment.ts` validates intent id,
  amount, currency, connected destination, livemode and selection hash against
  the frozen obligation in `src/lib/engagements/acceptedPayment.ts`.
- **PayPal routes to the platform account**, not the brand's. Keep it disabled
  for any tenant other than Southwest.
- **`/api/stripe/webhook` has no configured endpoint or secret** in the Stripe
  dashboard. Deployment item, needs dashboard confirmation.
- **Gmail / Microsoft / SMTP mail** are reserved UI slots showing "Coming soon".
  Only Zoho is wired.
- **`/api/email/send` does not rate-limit.** Staff-only, so abuse risk is small.
- **Tenant isolation is uneven** — the newer `/contacts` code bypasses the RLS
  transaction context used by `src/lib/crm/repository.ts`. This is the largest
  open risk before any outside firm shares the database. See the roadmap's P0.

For the full prioritized list, read `docs/SWAPP-REVIEW-AND-ROADMAP.md` and the
gate checklist in `docs/IMPLEMENTATION-STATUS.md`.

## First commands for the next agent

```bash
git status --short
git log -8 --oneline
npm run typecheck
npm test

# Use an existing dev server on :3000, or start one first.
npm run dev
npm run test:e2e
```

Before running any Prisma command against a real database, read
`docs/deployment/database-migration-state.md` — the migration history is
divergent and `prisma migrate deploy` / `migrate dev` must not be used.

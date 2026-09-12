# Coding-agent handoff

**Current state only.** Rewrite this file each session rather than appending to
it. Historical session logs live in `docs/handoff-archive/`; durable design and
reference material lives in `docs/`. If a note here would still be true in three
months, it belongs in `docs/`, not in this file.

Updated: 2026-09-12 (America/Chicago).

## Read first

`AGENTS.md` carries the non-negotiable rules and the map of every other
document. Read it before changing code.

Two things it does not say:

- `.claude/` is untracked, user-owned content. Do not modify it.
- Read `.local/COMPUTERS.md` for the local computer inventory. It is
  intentionally Git-ignored and must stay private.

## Push policy

**Changed 2026-09-12 by the owner — see `AGENTS.md` for the full rule.** The lead
agent may now push `main`, open pull requests and merge them. Still commit
locally at every phase boundary, still run the checks before a merge, still say
afterwards what was pushed or merged and what deployed. The contributor-tier
spark team keeps the narrower grant: `spark/<ticket>` and a PR, no merge.

If a phase is finished and unpushed, say so under "Repository state" below.

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

- `main` and `origin/main` are level at `3348553`. Nothing is unpushed on `main`.
- **`fix/duplicate-offer-dialog` is pushed, and PR #17 is open and unmerged.**
  One line in `DuplicateOfferButton.tsx`; see "Known gaps" below for what it
  fixes. Merging is the owner's job — a merge to `main` deploys production.
- `spark/support-level-note` (PR #15) and `spark/strikethrough-original-price`
  (PR #16) are merged and can be deleted.
- **`spark/duplicate-not-working` has no commits.** The spark team branched it,
  diagnosed the bug into `.opencode/plans/duplicate-not-working.md`, and stopped
  at the approval checkpoint. The fix was carried out in the main checkout
  instead, so this branch can be deleted.
- **Every other branch is merged.** `feat/saas-readiness`,
  `feature/services-step-redesign`, `feature/live-preview-tab`,
  `chore/normalize-line-endings`, `chore/add-ci`, `feature/contacts`,
  `feature/reviews`, `feature/team`, `spark/settings-width` and
  `docs/consolidate` are all ancestors of `main` and can be deleted. Older
  `origin/agent/*` branches are historical.
- `.gitattributes` pins `* text=auto eol=lf`, so the recurring Windows CRLF
  churn is fixed at the root.
- The bookkeeping-copy migration is committed but intentionally **not applied**
  to any database.
- `.claude/` shows as untracked and is deliberately never committed.

### Work in progress in the working tree

None. The working tree is clean; the only outstanding work is PR #17 awaiting a
merge decision.

## Health baseline

Measured on `fix/duplicate-offer-dialog` (one line ahead of `main` at `3348553`),
2026-09-12:

| Check | Result |
|---|---|
| `npm run typecheck` | passes |
| `npm test` | 75 files, 596 tests, all passing (~1.4s) |
| `npm run lint` | 0 errors, 8 warnings (`<img>` LCP advisories + one unused disable directive) |
| CI | `.github/workflows/ci.yml` runs typecheck, lint and unit tests on every PR and push to `main` |

Playwright is deliberately **not** in CI: those specs drive a real dev server
against a real Supabase database and sign in as staff, so they need secrets and
a reachable DB. `npm run test:e2e` stays a local step.

## Development machine

Development runs on **`ripley`** (Omarchy/Arch), reached from **`dalliance`**
(laptop) or **`steelbreeze`** (always-on agent host) over Tailscale — see
`AGENTS.md` for the machine split and the agent worktree rules. Agent panes live
in the herdr session `swapp`. On any of these Linux machines:

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
- A `next dev` server may already be listening on **:3000** — but as of
  2026-09-12 nothing was, and the herdr `swapp` session had no `dev` tab. Check
  before assuming, and start one if you need it.

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
- **Four tracked scripts carry hardcoded local Postgres passwords** —
  `scripts/migrate-local-to-supabase.cjs:13` and the three `test-*.ps1` scripts.
  Local/dev credentials, not cloud, but committed and readable by any model that
  opens them. A ticket exists at `.opencode/tickets/hardcoded-db-passwords.md` in
  the `swapp-spark` worktree and has never been run.
- **No DOM test harness.** All 596 unit tests are pure Node; there is no
  jsdom or testing-library, so component and overlay behaviour can only be covered
  by Playwright, which needs secrets and a database and is therefore not in CI.
  The duplicate-dialog bug fixed in PR #17 was exactly this class of defect and
  landed without an automated regression test for that reason.

- **The support-level block is matched by name.** The pricing card finds it with
  `serviceName.endsWith("Client Support")`. Renaming a service to, say,
  "Priority Support" makes the block silently disappear — brittle for one of the
  main differentiators between tiers. An explicit flag on the service would be
  sturdier.
- **The support level renders twice** — in its own block and again in "Included
  with this package". Left deliberately: for a tier whose only addition is
  support, removing it empties the "plus:" list. Worth a decision against real
  service data.
- **"Recurring services" renders as an empty header** when a brand has no paid
  recurring add-ons. Pre-existing from `2387f97`, whose e2e spec asserts the
  section is empty.
- **Duplicate in the offers table — fixed, pending merge (PR #17).** The row "…"
  popover hid the duplicate dialog by putting `display:none` on an ancestor of a
  top-layer `<dialog>`, so the contact picker never appeared and no offer was
  written. Any other dialog rendered as a child of that popover has the same
  problem; `Modal` uses no portal, so the pattern is worth watching for.

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

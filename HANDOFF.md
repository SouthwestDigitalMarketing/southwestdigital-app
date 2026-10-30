# SWapp handoff

**Current state only.** Rewrite this file each session rather than appending.
Historical session logs live in `docs/handoff-archive/`; durable design and
reference material lives in `docs/`. If a note here would still be true in
three months, it belongs in `docs/`, not here.

Checked on **ripley**, 2026-10-21 (America/Chicago), by Ummon — merging `origin/main` (PR #36 RLS) into `crew/leads-six-steps` ahead of the PR #37 merge. RLS sections below came with `main`; Leads sections are this branch's.
`README.md` describes the project; this file hands off the work.

## Read first

Never push without explicit user instruction. Do not run
`prisma migrate deploy`, `prisma migrate dev`, or `prisma db push` — see
`docs/deployment/database-migration-state.md`. Do not send outbound SMS unless
the owner named the recipient in this session. Crews do not push, PR, or merge.

## RLS readiness job (branch `crew/rls-readiness`, base `d59fe59`)

Crew job `rls` (Ummon's crew, worker `worker-rls`), started 2026-10-21. Goal:
prepare code and docs for a restricted-role + RLS cutover. **Cutover remains
NOT READY and requires Tom's separate decision.** No production database or
env was accessed. No push, PR, merge, deploy, or outbound contact occurred.
The sections below this one (Repository state, Health, and the rest) were
written on other branches and have **not** been checked against this branch.

Milestones: M1 sweep; M2 fixes (ACCEPTed); M3 scratch-Postgres rehearsal
(ACCEPTed); M4 cutover runbook (ACCEPTed); M5 brand-slug rename plan
(ACCEPTed); M6 final handoff (documentation complete, reviewer review
pending). **PRODUCTION CUTOVER NOT READY.** Do not mark ready-to-ship until
reviewer ACCEPTs M6.

- **M1 sweep:** 36 direct `Contact` call sites outside
  `withBrandDataTransaction` plus 4 nested RLS reads; 16 paths could fail
  silently. Source report: `~/.grok/team/swapp/jobs/rls/sweep.md`.
- **M2 fixes:** implementation commit `b040fb8a444b8570f5bda7d6486c03061ebebf0c`,
  accepted at `1e9a296058a67815f5f17ec92569ee6e89eb10ad`. Staff brand helpers
  return the authorized context; swept Contact paths and nested reads use
  context-bound queries. R1 range: `f9aa45f6aba51afdf3c1f08dd8c896f6a7f5c1ac..b040fb8a444b8570f5bda7d6486c03061ebebf0c`;
  R2 range: `cfea070ef1a252078c1331050f4b8a6f54fff5b4..1e9a296058a67815f5f17ec92569ee6e89eb10ad`.
  Reports: `jobs/rls/worker-m2-r1.md` and
  `~/.grok/team/swapp/jobs/rls/worker-m2-r2.md`.
- **M3 scratch rehearsal: ACCEPTed.** Evidence report stays at the exact repo
  path `~/projects/worktrees/swapp-rls/jobs/rls/worker-m3-r1.md`. A disposable
  `postgres:17.5` container bound only to `127.0.0.1:54329` was removed after
  checks. The full 40-file replay stopped after 13 at
  `20260827200000_add_catalog_service_real_estate_specific` because
  `catalog_services` baseline is missing. Schema-derived baseline + two RLS
  migrations verified all six protected tables. Runtime had DML on 107 app
  tables, no `_prisma_migrations`, and `NOBYPASSRLS`; it saw no CRM rows
  without context and could not cross-write. Migrator CREATE did not permit
  ALTER of existing `Contact` because it owned no tables. Restricted-role full
  suite: 880/881, one pre-existing pipe contacts contract/test mismatch.
  Evidence range: `1e9a296058a67815f5f17ec92569ee6e89eb10ad..37d73d6a0d96d02dd8fdc843e0434395a9c83630`;
  report commit `37d39f7246e4dcb589eeb1fa6bf6bfe9d12ab6a1`.
- **M4 runbook:** `docs/deployment/rls-and-roles-cutover.md` now has a
  preflight checklist, observed grant matrix and 107-table inventory,
  stage-by-stage rollback guidance, and explicit owners/evidence for all five
  open gates. It keeps cutover **NOT READY**. M4 report:
  `jobs/rls/worker-m4-r1.md`. Reviewed range:
  `37d39f7246e4dcb589eeb1fa6bf6bfe9d12ab6a1..e8968ed1ee8138cd53c0522c771f30535a209893`.
- **M5 brand-slug rename plan:** `docs/deployment/brand-slug-rename-plan.md`
  documents the guarded SQL, preconditions, verification queries, ordering,
  and rollback for `bc` → `bookkeeping-conroe` and `treb` →
  `real-estate-bookkeeper`. It explicitly states the database rename has NOT
  been done. No SQL or database connection was used. M5 was ACCEPTed over
  `e8968ed1ee8138cd53c0522c771f30535a209893..3fd82b9c7aa86e43cc68b4b5cdcf1ff4b04d1f57`.
  Report: `jobs/rls/worker-m5-r1.md`. All five M4 gates and owners remain
  open; cutover stays **NOT READY**.
- **Open gates:** Ummon/app owner must supply and rehearse a repeatable full
  migration baseline/chain; define and rehearse DDL ownership for existing
  tables; and reconcile the pipe contacts mismatch separately without changing
  that API in this branch. Tom owns target fingerprint, production grants,
  backup/restore, secret configuration, preflight/rollback verification and
  cutover decision after those gates. Albedo owns owner credential rotation
  and secret cleanup after an approved cutover.
- **M6 final handoff:** `jobs/rls/worker-m6-r1.md` records M1–M5 evidence,
  exact ranges, checks, limits, open gates, and next step. M6 report and this
  handoff update are pending reviewer review; reviewer ACCEPT is required
  before Foreman marks ready-to-ship.
- **Incident attribution correction:** board record `488743eaaeb4` was created
  by `worker-rls` running `board now` without authorization. The Foreman
  instructed `worker-rls` to stop all board CLI use and not attempt correction.
  The accepted M5 review report incorrectly says Tom directed the no-follow-up
  instruction. This M6 handoff and report state the correction explicitly;
  the accepted M5 report is left unchanged.
- **Current boundary:** the database rename has NOT been done. Production
  cutover remains NOT READY. No production DB/env access, SQL execution, board
  CLI use, push, PR, merge, deploy, or outbound contact is part of M6.

## Repository state

- Branch: `crew/leads-six-steps`; M6 base `c62bba91f2bd571fd8590a84638b5909a2dbe3f8`. M6 HANDOFF and report commit: `fdb1e4ecac3a6f779b01957dcb356e2c823b2e3e`. M1–M6 commits are local and unpushed.
- M2 (`208cdeb`), M3 (`ed85a1c`), and M4 (`d966ff4`) are local and unpushed.
  M2 stores and returns validated `lead_step`; M3 adds the Leads board columns
  and mapped moves; M4 updates `MeetingLead.updatedAt` for every pipeline card
  move. The additive M2 migration was checked on scratch Postgres only. No
  production database or environment was read or changed.
- This branch also contains the prior M1 commits `3613d9b` and `a14d2fa`.

## Leads six-step job (crew, branch `crew/leads-six-steps`)

Added 2026-10-21 by crew Worker (`worker-leads`) for Ummon. Job brief:
`~/.grok/team/swapp/jobs/leads/JOB.md` (ripley/dalliance crew dir, not in git).

Goal: pipe's Bookkeeping Conroe Leads board has six steps (`reach`, `qb`,
`book`, `call`, `quote`, `nurture`); SWapp should store, return, and show them
and make SWapp-side moves visible to pipe. Source notices: `ddc3441d4fb9`,
`2549d4158fa7`, `f2f5e81c323c`.

- **M1 contract audit: done** (no code change). Findings are in
  `~/.grok/team/swapp/jobs/leads/contract.md`. Headlines: unknown request
  fields are **ignored, not rejected** (so a premature `lead_step` is dropped
  silently); the code names no owning brand (caller sends the slug; no
  Lochside brand exists; pipe's own brand list is the same five slugs as the
  seed script); dedupe keys are contact id/email/phone+same-person,
  business name, deal `(brandId, pipeId)`; `POST /deals` is a full replace of
  working fields (omitted `stage` becomes `prospect`); and a stage move in
  SWapp (`movePipelineItemAction`) updates only `PipelineItem.updatedAt`, while
  the route reports `MeetingLead.updatedAt` — so M4 is a real gap, though
  pipe's current pull diffs field values and does not read `updatedAt`.
  Also: a pipe push is a full replace, so a later local pipe edit pushes its
  older stage over a SWapp-side move; M3/M4 make moves visible, not winning.
- **M2: done**, code commit `208cdeb` (base `d59fe59`). `lead_step` accepts
  `reach|qb|book|call|quote|nurture|null`; values are checked against the
  existing stage mapping, persisted in nullable `MeetingLead.leadStep`, and
  returned as `deal.leadStep`. An absent value preserves the stored step while
  its stage still matches; a stage move outside that stage clears it. Explicit
  `null` clears it. See
  `~/.grok/team/swapp/jobs/leads/worker-m2-r1.md` for commands and exact results.
- **M3: implemented**, code commit `ed85a1c` (base `df769f0`). The
  `pipe-prospects` board shows Reach decision maker / Get QB access / Book
  review call / Conduct review call / Send Quote & Contract / Nurture as
  columns. It keeps Prospect, Won, and Lost visible as additional columns.
  Unset steps on lead/talking/proposed cards appear under their stage's first
  matching step with a “Step unset” note; moving the card sets a step. A move
  writes the mapped `PipelineItem.stageId` and `MeetingLead.leadStep` in one
  transaction. Other pipelines keep their existing stages.
- M3 design choices: virtual step columns reuse existing pipe stages because
  several Leads steps map to the same stage; existing non-Leads stages remain
  visible; unset values are shown by stage and stay null until a card is moved.
- **M4: implemented**, code commit `d966ff4` (base `db7efda`). The shared
  `movePipelineItemAction` now updates `MeetingLead.updatedAt` and
  `PipelineItem.stageId` in one transaction for every pipeline move. The
  timestamp is strictly greater than its previous value, including when the
  current clock time is equal or earlier. Leads moves also save `leadStep` in
  that transaction. Tests cover timestamp advancement for general moves and
  all six Leads steps.
- Move-path audit: `movePipelineItemAction` is the user-driven stage-move path.
  `contacts/automation.ts` and tag actions create/place items but do not move
  existing ones. Pipe deal upserts update the associated `MeetingLead` row
  along with stage/step, so Prisma `@updatedAt` already advances there.
  `PipeDeal.updatedAt` reads `MeetingLead.updatedAt`. The M1 contract audit
  notes pipe's current pull fetches the full list and compares values rather
  than using `updatedAt`; this change makes the returned timestamp truthful.
- **M5: ACCEPT** (`jobs/leads/review-m5-r1.md`, range `315267c4cd0366f4652227f6dd529cfba9eb0284..c62bba91f2bd571fd8590a84638b5909a2dbe3f8`).
  [`jobs/leads/nurture.md`](jobs/leads/nurture.md) records Tom's tentative
  first-cut inputs (convert the offer during days 0–7 after quote, with quote
  and contract expiring at day 7; then long-term nurture), and lists the
  unanswered decisions and triggers. It deliberately proposes no final stage
  list and includes no application changes.
- Checks: `npm run typecheck` passed; `npm run lint` passed (0 errors, 9
  warnings); `npm test` passed (111 files, 1 skipped; 882 tests, 5 skipped).
  No database was needed for M4. No production database or environment was
  touched.
- M5 docs check: `git diff --check` passed. Application checks were not rerun
  because this change contains documentation only; M4's verified results
  remain above.
- **M6: documentation handoff complete**, report: `jobs/leads/worker-m6-r1.md`. Proposed reply to Kassad is recorded there and was not sent. Nurture remains tentative; no final stages selected. The pipe-side change remains Kassad's action after `leadStep` is live.
- M6 changes only documentation and the worker report. `git diff --check` passed. Typecheck, lint, and tests were skipped for this docs-only milestone. No production DB/env, external contact, board CLI, push, PR, merge, or deploy was used.

## Health

**Verified 2026-10-21 on `crew/leads-six-steps`; M6 handoff/report committed locally.**
`npm run typecheck` passed; `npm run lint` passed with 0 errors and 9 warnings;
`npm test` passed with 111 files passed, 1 skipped, 882 tests passed, and 5
skipped. M4 did not use a database. Production was not contacted. The numbers in
`docs/IMPLEMENTATION-STATUS.md` (583 tests across 74 files, 0 lint errors, 8
`<img>` advisories) are dated 2026-09-08 and are carried as history, not as a
current claim. Re-run the checks before relying on them.

## Incoming work: sales pipelines

Tom reassigned the SWapp sales-pipeline work from Ummon to Kassad on
2026-10-16 because the design context sits in the Sales session. Board notice
`6bf1f2fd2e4c`; survey record `91c374c539a8`.

Read-only survey findings, from files only:

- `Pipeline` / `PipelineStage` / `PipelineItem` already provide configurable
  pipelines with ordered stages, `isTerminal` exits, and a per-stage
  `valueMultiplier`. `PipelineItem` is unique per `(pipelineId, leadId)`, so
  one lead can occupy several pipelines at once.
- `ContactTagAutomation` maps a tag to a pipeline and optional stage, and
  `applyTagPipelineAutomation` in `src/lib/contacts/automation.ts` acts on it
  when a contact is tagged. An `INDUSTRY` tag yields `LeadKind.PROSPECT`; any
  other kind yields `LeadKind.LEAD`.
- `createStarterPipelinesAction` seeds four templates from
  `src/app/(app)/pipeline/templates.ts`: `PROSPECTS`, `LEADS`,
  `CLIENT_PHASE_1`, `CLIENT_PHASE_2`. The Prospects template already contains
  `qbo-invite-requested` and `qbo-access-received`.
- **Two lead models.** `MeetingLead` carries `LeadKind`,
  `bookkeepingCategory`, contacts, and pipeline items — it is the CRM lead the
  pipelines use. The separate `Lead` model carries `LeadStatus` and attribution
  touches and is **not** in pipelines. The naming is misleading and matters to
  anyone building on pipelines.
- Quote page is `Quote.publicToken` → `/proposal/<token>`; signature and
  deposit land on `Engagement` (`signedAt`, `signerIpAddress`,
  `agreementTextHash`, `DiscoveryDepositStatus`).
- **Missing** for the requested model: a satisfaction pipeline terminating in
  a 5-star review (`ReviewRequest` exists as a model but no pipeline targets
  it), an upsell pipeline, and any concept of a contact attempt that fails to
  reach the decision maker (gatekeeper, no answer, voicemail). The last needs
  a schema addition, which under the migration constraint above means reviewed
  idempotent SQL and explicit per-change owner approval.

## Open follow-ups

- Whether the four starter pipelines were ever actually created in the live
  database is **unknown**; a read-only survey is staged but had not been run
  when this was written.
- `docs/IMPLEMENTATION-STATUS.md` and `README.md` both still describe branch
  and health state from mid-September. Only this file was brought current.

## Pipe sync routes: on branch, unapplied (2026-10-19)

- Branch `feat/pipe-contacts-first-last-name` carries the complete-sync
  build: `/api/pipe/contacts` now stores first/last names (split from the
  full name when missing); new `/api/pipe/businesses` (accounts plus people
  links with roles and can-decide) and `/api/pipe/deals` (leads keyed by
  pipe number, stages in an auto-created `pipe-prospects` pipeline per
  brand, next steps, money, invoice, who-said-yes, business link).
- Two additive migrations, NOT applied anywhere:
  `..._pipe_businesses_can_decide` (`CustomerContact.canDecide`) and
  `..._pipe_deal_fields` (`MeetingLead` pipe working fields plus
  `customerAccountId`, unique `(brandId, pipeId)`). Production apply needs
  Tom's go; re-run the restricted-role scratch test against the new columns
  first (grants are table-level, so no grant change is expected).
- Verified this session: 56 pipe tests pass, `tsc --noEmit` clean, eslint
  clean on `src/lib/pipe/` and `src/app/api/pipe/`. The DB-backed
  integration test still needs a live scratch Postgres (none on this box).

## Pipe tags and Reviews/Referrals config (Ummon, 2026-10-23)

- Merged: PR #40 `POST/GET /api/pipe/tags` (`src/lib/pipe/tags.ts`; add runs `applyTagPipelineAutomation`, remove only drops the link). PR #41 data migration `prisma/migrations/20261023220000_reviews_referrals_pipelines/migration.sql`.
- Checks: typecheck/lint/test pass on both; Netlify previews fail on #38-#41 alike. SQL never run against a database.
- NOT applied to production. Apply by hand: `npx dotenv-cli -e .env.local -- npx prisma db execute --file <file> --schema prisma/schema.prisma`, after Tom sees the SQL. Brand slug is `bookkeeping-conroe` near its top.
- Limit: one stage per tag (reviews -> Welcome); onsite/training must be moved to Check-in by hand. Tags sit on the contact, not the deal.
- Unfinished: `dueAt` on PipelineItem (day 25 / day 3) deferred by Sol; backfill of pipe #6, #7, #4, #48 is Sol's request to Tom. Not confirmed whether #40 is live.

## Session 2026-10-27 (Kassad) — Mike Arnett quote, Vercel block, proposal UI

- Vercel: team `lochside-llc` was on Hobby and soft-blocked (FAIR_USE_LIMITS_EXCEEDED / functionInvocation; whole site returned 402 DEPLOYMENT_DISABLED). Tom upgraded. Likely cause: long-open `pipe` boards polling the API (sales repo branch `fix/board-poll-rate`). Netlify deploy-preview check fails on every PR (not investigated); production is Vercel.
- The app picks the portal by hostname: use `app.bookkeepingconroe.com`, not `swapp-chi.vercel.app` ("Portal not configured").
- Merged: #45 (10 Google reviews on proposals, fixed photo URLs, required add-ons: `required: true` add-ons are pre-selected, shown under Required to get started, and enforced in `proposalCheckout.ts`), #46 (no price at card top), #47 (Service level section, no top Select button), #48 (gold section bars, Steady/Fast-Lane/White-Glove copy in `SERVICE_LEVEL_COPY`). Not viewed in a browser by me.
- Quote `cmvqzmevb0003jj0e9d8suo8g` (Mike Arnett, draft, never sent) edited directly in the database: Maintain 450 / Improve 550 / Grow 675 (discretionaryMultiplier 0.465), onboarding override 495, required migration add-on 495, services seeded from the catalog, lower-tier add-on prices ~half of the US Promoline quote (guess), testimonial video copied from quote `cmtxrkuqk0005kx04apbc0zic`. Backups: scratchpad `quote_backup_*.json` (session-local). Assumed, unconfirmed: 2 credit cards, 0 contractors, Gusto.
- Pricing facts: the engine (`buildPackagePricing`) priced Maintain at 965; Tom's verbal rule on the call was avg transactions x2, 450 minimum. Tom chose the engine, then set the floor to 450. Advanced receipt management minimum for the 100-499 band is 499 (hidden on this quote).
- Open: new reviewers (Sara Manore, Chris Saltzburg, Stephen MacDonald, Tom MacDonald) have no photo files in `/images/google-review-profile-pics/`; editor has no UI for the `required` flag; `reached` deal stage returns 400 on sync.

## Session 2026-10-27/28 (Kassad) — payments, publishing, Mike Arnett quote

- **Stripe webhook (was missing; payments were never marked PAID).** Live account Southwest Digital Marketing (`acct_1SAgm22R5qsZ6eIF`): event destination `swapp-payments` (`we_1UVKw82R5qsZ6eIFKFllcmRP`) -> `https://app.bookkeepingconroe.com/api/stripe/webhook`, event `payment_intent.succeeded` only, snapshot payload. `STRIPE_WEBHOOK_SECRET` set in Vercel production (sensitive) and redeployed. Verified with a live $1 card test: sign 19:50:05, webhook 19:50:16, engagement DEPOSIT_PAID, "You're all set". Not created: a second destination for connected accounts (`account.updated`). The Stripe MCP is connected read-only. Production keys are live (`pk_live_`); Stripe test card numbers will be declined. A "test proposal" (`isTestProposal`) is a real $1 live charge: refund it in Stripe.
- **Staff preview vs client link.** `?staffPreview=1` (added by the arrow icon beside the link on the Email step) only works for a signed-in staff session and fakes signing/payment. The plain link is live: never tap Pay on it for a real quote. A phone that is not signed in sees the live page.
- **Builder uses the browser's saved copy.** Preview and Save use localStorage keyed by offer id; a stale copy can overwrite the database on Save/Publish. Use a private window (empty storage) to publish an existing quote.
- **Field allowlists drop new fields.** `sanitizeAdditionalOption` (optionsTemplates.ts) and `publicAssessmentSchema` (publicProposal.ts) rebuild objects from a fixed list. A new assessment/option field (e.g. `required`, `contractFollowsPayment`) must be added to both, plus a test (#52, #53).
- **Add-on display order after publish = `catalog_services.priority`** (not the saved array order). D&M 101, Personal 102, Sales Tax 120, Budget 130.
- **Merged this session:** #45 reviews+required add-ons, #46 card header price, #47 service level section, #48-#50 colors, #51 stars+payment lines, #52 required flag survives save/public page + test checkout, #53 confirmation wording (`contractFollowsPayment`), #54 one name per support level (`serviceLevelTitle`), #55 step bar fits phones. All CI green.
- **Mike Arnett quote `cmvqzmevb0003jj0e9d8suo8g`:** published (revision 1), NOT sent. Maintain 450 / Improve 550 / Grow 675, annual 15%, onboarding 350 + required migration 640, acceptance page then contract via QuickBooks within 24 hours, optional D&M 250, Personal 250 (typically 450), Sales Tax 295, Budget 295. Cover text reworded (not real estate). Copy-edited fields live in draft, published and revision rows.
- **Open:** Tom to refund two $1 test charges (`pi_3UVKca2R5qsZ6eIF0llYGrlN`, `pi_3UVL462R5qsZ6eIF1xuhl6Rk`); phone check of Services/Agreement/Payment after #55; Donna drafts the email (Tom's text, fixed for "short acceptance then contract") only after Tom approves; a local dev copy at `~/projects/worktrees/swapp-dev` (branch `dev/local-iterate`, local-only hacks, not pushed) should be deleted.

## Session 2026-10-29/30 (Ummon) — proposal behavior tracking + Microsoft Clarity

Tom's goal: see what clients do on the live proposal's pricing step (most expensive package shows first; the cheapest is a long scroll away).

**Shipped (PR #57, squash-merged to main as `1d9534c`):**
- `ProposalViewEvent` model + migration `prisma/migrations/20261029200000_proposal_view_events/`.
- Public write-only `POST /api/proposal/track` (`src/app/api/proposal/track/route.ts`): always 204, failures only logged. Input is filtered by `src/lib/quotes/viewEvents.ts` (tested).
- `useProposalTracking` (`src/app/(app)/offers/builder/useProposalTracking.ts`), wired into `OfferProposalPreview.tsx`. Records view, step, scroll depth (25/50/75/100), package cards seen (`data-track-package` / `data-track-position` on each card), package select, intro video play, leave.
- Loads Microsoft Clarity, project id `z5jfr38x6b` (public, not secret; `NEXT_PUBLIC_CLARITY_PROJECT_ID` overrides). Tags each visit with the proposal token, mirrors events as Clarity custom events (e.g. `package_seen_maintain`), masks signer name/title/email inputs.
- Active only when `live && livePublic && !isSimulation && !embedded`. Staff preview, simulations and embedded renders record nothing.

**Checks:** `tsc --noEmit` clean; eslint 0 errors (9 existing warnings); vitest 930 passed, 5 skipped. Vercel and `typecheck / lint / test` passed on the PR. Four Netlify checks (header rules, pages changed, redirect rules, deploy-preview) fail on every PR including #56; not caused by this work.

**NOT done:**
1. **Migration is not applied to production.** `npm run build` is `prisma generate && next build` and does not migrate. Until `prisma migrate deploy` runs against the production database, `/api/proposal/track` drops events quietly (the proposal still works). Needs Tom's yes first; it adds one table and touches no existing data.
2. **Not verified live.** After deploy: open a real client proposal link in a normal (non-staff) window, scroll to the bottom of the pricing step, then check `https://clarity.microsoft.com/projects/view/z5jfr38x6b` (data can take about 2 hours). Also confirm rows land in `proposal_view_events` once the migration is applied.
3. **Offers-page timeline view** (per proposal: opened, reached the cheapest package, chose one, signed) is not built. Read `proposal_view_events` by `quoteId`, grouped by `sessionId`. `Quote.firstViewedAt` already exists and is separate.
4. Optional, not asked for: a notification when a client opens or stalls.

**Notes:**
- Clarity account is Tom's; sign-in is his. The proposal link domain was not confirmed (probably `bookkeepingconroe.com` or a subdomain); Clarity does not restrict by domain.
- The token is sent to Clarity as a tag; it is already in the page URL Clarity records.
- The main checkout `~/projects/southwestdigital-app` was on `fix/pipe-contact-updates-deletes` with an uncommitted `HANDOFF.md` edit that is not part of this work. Left untouched.

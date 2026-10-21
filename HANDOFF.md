# SWapp handoff

**Current state only.** Rewrite this file each session rather than appending.
Historical session logs live in `docs/handoff-archive/`; durable design and
reference material lives in `docs/`. If a note here would still be true in
three months, it belongs in `docs/`, not here.

Checked on **2026-10-21** (America/Chicago), by Worker (`worker-leads`).
`README.md` describes the project; this file hands off the work.

## Read first

Never push without explicit user instruction. Do not run
`prisma migrate deploy`, `prisma migrate dev`, or `prisma db push` — see
`docs/deployment/database-migration-state.md`. Do not send outbound SMS unless
the owner named the recipient in this session. Crews do not push, PR, or merge.

## Repository state

- Branch: `crew/leads-six-steps`; M2 base: `d59fe59` (`origin/main` at job
  start); M2 code head: `208cdeb` (`Pipe deals: persist validated Leads steps`).
- The M2 commit is local and unpushed. It adds the optional validated
  `lead_step` field, persists and returns it, and adds an idempotent nullable
  `MeetingLead.leadStep` migration. No production database or environment was
  read or changed.
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
- Checks: `npm run typecheck` passed; `npm run lint` passed (0 errors, 9
  warnings); `npm test` passed (109 files, 1 skipped; 874 tests, 5 skipped).
  The migration was applied twice to a disposable Postgres 16 scratch container;
  both runs succeeded and the column is nullable `text`. The container was
  stopped and removed. No production database or environment was touched.
- Next: M3 (show and move the six steps in SWapp screens). M4 remains separate;
  M5 is design note only. M2 has not been pushed or deployed.

## Health

**Verified 2026-10-21 on `crew/leads-six-steps` at M2 code head `208cdeb`.**
`npm run typecheck` passed; `npm run lint` passed with 0 errors and 9 warnings;
`npm test` passed with 109 files passed, 1 skipped, 874 tests passed, and 5
skipped. The migration ran twice on scratch Postgres 16. Production was not
contacted. The numbers in
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

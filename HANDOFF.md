# SWapp handoff

**Current state only.** Rewrite this file each session rather than appending.
Historical session logs live in `docs/handoff-archive/`; durable design and
reference material lives in `docs/`. If a note here would still be true in
three months, it belongs in `docs/`, not here.

Checked on **dalliance**, 2026-10-16 (America/Chicago), by Kassad.
`README.md` describes the project; this file hands off the work.

## Read first

Never push without explicit user instruction. Do not run
`prisma migrate deploy`, `prisma migrate dev`, or `prisma db push` — see
`docs/deployment/database-migration-state.md`. Do not send outbound SMS unless
the owner named the recipient in this session. Crews do not push, PR, or merge.

## Repository state

- Branch: `docs/restore-handoff-and-fix-agents-refs`.
- `origin/main` is `ab34b8b` (`removed AGENTS.md, superceded by
  tmacdonald7/agents/agents.md`). `main` was level with it, 0 ahead / 0 behind.
- Working tree was **not** clean on arrival: nine uncommitted Markdown files
  sat on local `main`, with `HANDOFF.md` staged for deletion. They are now
  commit `5f6222f` on this branch, committed unmodified so the work is
  recoverable, then corrected in the commit after it. No source or schema file
  was involved.

### What this branch does

`ab34b8b` deleted in-repo `AGENTS.md` in favour of the global agent guidance,
which left documentation pointing at a file that no longer exists. The
uncommitted pass found on `main` repointed those references but also deleted
`HANDOFF.md` and folded its content into `README.md`. This branch keeps the
necessary half and corrects the rest:

- `HANDOFF.md` restored as its own file (this one), with current state rather
  than the stale text that was folded into `README.md`.
- `README.md` returned to its project-only shape, with its single dead
  `AGENTS.md` pointer replaced by the global guidance. Its `HANDOFF.md`
  pointer was already correct and is kept.
- Seven dead `AGENTS.md` references fixed across `docs/SWAPP-BRIEF.md` (2),
  `docs/SWAPP-REVIEW-AND-ROADMAP.md` (3), `docs/local-development.md` (1), and
  `docs/offers/services-ui-handoff.md` (1). None remain outside the
  `~/.codex/AGENTS.md` global-guidance blocks.
- `CLAUDE.md` points at `README.md`, this file, and the global guidance.

The stale text this replaces claimed branch `feat/review-requests-hardening`,
`origin/main` `c400bb4`, and "working tree should be clean". None of the three
was true on 2026-10-16.

Docs only. No source, schema, dependency, or configuration change.

## Leads six-step job (crew, branch `crew/leads-six-steps`)

Added 2026-10-21 by crew Worker (`worker-leads`) for Ummon. Branch base is
`d59fe59` (`origin/main`). Not pushed; crews do not push. Job brief:
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
- Baseline on this branch before any change (2026-10-21): `npm run typecheck`
  exit 0; `npm run lint` exit 0 (0 errors, 9 warnings); `npm test` 109 files
  passed, 1 skipped; 871 tests passed, 5 skipped.
- Next: M2 (`lead_step` on the deals route + additive migration, scratch
  Postgres only). No migration is applied anywhere; production apply needs
  Tom's go.

## Health

**Not verified in this session** (superseded for branch
`crew/leads-six-steps` by the baseline in the section above, which is current
as of 2026-10-21 on that branch only). No test, typecheck, lint, or build was run,
and the database was not contacted. The numbers in
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

# SWapp handoff

**Current state only.** Rewrite this file each session rather than appending.
Historical session logs live in `docs/handoff-archive/`; durable design and
reference material lives in `docs/`. If a note here would still be true in
three months, it belongs in `docs/`, not here.

Checked on **dalliance**, 2026-10-21 (America/Chicago), by Ummon.
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
(ACCEPTed); M4 cutover runbook (completed, reviewer review pending); M5
brand-slug rename runbook (not started; wait for M4 reviewer ACCEPT); M6 final
handoff.

- **M1 sweep:** 36 direct `Contact` call sites outside
  `withBrandDataTransaction` plus 4 nested RLS reads; 16 paths could fail
  silently. Source report: `~/.grok/team/swapp/jobs/rls/sweep.md`.
- **M2 fixes:** implementation commit `b040fb8a444b8570f5bda7d6486c03061ebebf0c`,
  accepted at `1e9a296058a67815f5f17ec92569ee6e89eb10ad`. Staff brand helpers
  return the authorized context; swept Contact paths and nested reads use
  context-bound queries. Reports: `jobs/rls/worker-m2-r1.md` and
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
- **M4 runbook:** `docs/deployment/rls-and-roles-cutover.md` now has a
  preflight checklist, observed grant matrix and 107-table inventory,
  stage-by-stage rollback guidance, and explicit owners/evidence for all five
  open gates. It keeps cutover **NOT READY**. M4 report:
  `jobs/rls/worker-m4-r1.md`. Implementation range and documentation-only
  checks are recorded there.
- **Open gates:** Ummon/app owner must supply and rehearse a repeatable full
  migration baseline/chain; define and rehearse DDL ownership for existing
  tables; and reconcile the pipe contacts mismatch separately without changing
  that API in this branch. Tom owns target fingerprint, production grants,
  backup/restore, secret configuration, preflight/rollback verification and
  cutover decision after those gates. Albedo owns owner credential rotation
  and secret cleanup after an approved cutover.
- **Next:** reviewer inspects M4's exact range. Do not start M5 until M4 review
  ACCEPT. Production cutover, production DB/env access, push, PR, merge, deploy,
  and outbound contact remain outside this work.

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

## Health

**Not verified in this session.** No test, typecheck, lint, or build was run,
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

# RLS M6 worker final report

Date: 2026-10-21 (America/Chicago)
Repo: `~/projects/worktrees/swapp-rls`
Branch: `crew/rls-readiness`
M6 base: `3fd82b9c7aa86e43cc68b4b5cdcf1ff4b04d1f57` (M5 ACCEPTed head)
M6 HANDOFF head: `6e9fe4442234f42cf06514216fcb1996bb0e107c`
M6 exact HANDOFF range: `3fd82b9c7aa86e43cc68b4b5cdcf1ff4b04d1f57..6e9fe4442234f42cf06514216fcb1996bb0e107c`
Initial full M6 range submitted for review: `3fd82b9c7aa86e43cc68b4b5cdcf1ff4b04d1f57..44b581b9ea83a994c1cb070f9a82e53ed8d6a2fe`
Commit `44b581b9ea83a994c1cb070f9a82e53ed8d6a2fe` adds this worker report only; it does not change `HANDOFF.md`.
Status: **PRODUCTION CUTOVER NOT READY**

## M1–M5 accepted milestone record

### M1 — sweep, ACCEPT

- Exact reviewed range: `d59fe59841d1631849e5458dcf5f57f682bc7d0f..f9aa45f6aba51afdf3c1f08dd8c896f6a7f5c1ac`.
- Change: HANDOFF summary only; no source/schema/test/config changes.
- Findings: 36 direct Contact call sites outside `withBrandDataTransaction`, 4 nested RLS reads, and 16 of the 36 direct paths could fail silently. Uncle Invoice's 22 models use its separate `uncleinvoice` schema.
- Worker report: `~/.grok/team/swapp/jobs/rls/worker-m1-r1.md`.
- Sweep evidence: `~/.grok/team/swapp/jobs/rls/sweep.md`.
- Review: `~/.grok/team/swapp/jobs/rls/review-m1-r1.md`, ACCEPT.
- Worker ran no tests because no code changed. Reviewer baseline checks: `npm run typecheck` passed; `npm run lint` passed with 0 errors / 9 warnings; `npm test` passed with 109 files passed, 1 skipped, 871 tests passed, and 5 skipped (876 total). Call-site count was 36.

### M2 — context fixes and regression coverage, ACCEPT r2

- Initial implementation: `f9aa45f6aba51afdf3c1f08dd8c896f6a7f5c1ac..b040fb8a444b8570f5bda7d6486c03061ebebf0c`. The follow-on M2 r1 report/HANDOFF commit is `cfea070ef1a252078c1331050f4b8a6f54fff5b4`.
- R1 worker report: `jobs/rls/worker-m2-r1.md`. It returned the authorized brand context from the staff helper, wrapped swept Contact paths and split nested RLS reads into context-bound queries.
- R1 checks: typecheck passed; lint passed with 0 errors / 9 existing warnings; test suite passed with 109 files, 871 tests passed and 5 skipped. No DB access.
- M2 r1 review requested regression coverage. Follow-up exact range: `cfea070ef1a252078c1331050f4b8a6f54fff5b4..1e9a296058a67815f5f17ec92569ee6e89eb10ad`.
- R2 report: `~/.grok/team/swapp/jobs/rls/worker-m2-r2.md`. Review: `~/.grok/team/swapp/jobs/rls/review-m2-r2.md`, ACCEPT. Review r1 (CHANGES) and r2 are in `~/.grok/team/swapp/jobs/rls/review-m2-r1.md` and `~/.grok/team/swapp/jobs/rls/review-m2-r2.md`.
- Five focused regressions cover silent contact-import duplicate detection, offer contact sync, empty Discounts picker, Client split contact read, and Pipeline split LeadContact/Contact reads. Each checks authorized brand `brand-42` and actor `staff-7` reach the context wrapper and verifies query/result behavior. Reviewer confirmed all five fail on pre-M2 code and pass at the accepted head.
- R2 checks: focused test 1 file / 5 tests passed; typecheck passed; lint passed with 0 errors / 9 warnings; full suite passed with 110 files passed, 1 skipped, 876 tests passed, and 5 skipped (881 total); diff check passed. No DB/env access.

### M3 — scratch PostgreSQL rehearsal, ACCEPT

- Code/evidence range: `1e9a296058a67815f5f17ec92569ee6e89eb10ad..37d73d6a0d96d02dd8fdc843e0434395a9c83630`.
- Separate report commit/head: `37d39f7246e4dcb589eeb1fa6bf6bfe9d12ab6a1`.
- Repo worker report, preserved at its exact path: `~/projects/worktrees/swapp-rls/jobs/rls/worker-m3-r1.md`.
- Review: `~/.grok/team/swapp/jobs/rls/review-m3-r1.md`, ACCEPT for M3 only.
- Scratch: disposable PostgreSQL 17.5 container `swapp-rls-m3-20261021` bound only to `127.0.0.1:54329`; stopped and removed after checks. M3 review independently repeated the rehearsal on `127.0.0.1:54331`. No remote or production DB was used. A schema-derived baseline was applied manually, followed by the two RLS migration SQL files; no Prisma deploy/dev/db-push command was run.
- Migration replay limit: attempting all 40 repository migration SQL files from empty scratch passed the first 13 and failed at `20260827200000_add_catalog_service_real_estate_specific/migration.sql` because relation `catalog_services` did not exist. The complete historical migration chain remains unproven.
- Runtime checks: all six target tables had ENABLE and FORCE RLS. Runtime had DML on 107 application tables, no `_prisma_migrations` access, `NOBYPASSRLS`, no table ownership or schema CREATE. It saw zero protected rows without context, only the contextual brand's rows with context, and RLS rejected a cross-brand Contact insert. Runtime could not create tables, read migration metadata, disable RLS, or SET ROLE to migrator. Migrator could CREATE a new table but could not ALTER existing Contact because it owned no tables.
- Test result: pipe integration path had 4 passed / 1 failed. Restricted-role full suite had 110 files passed, 1 failed; **880 passed / 1 failed (881 total)**. The sole failure is a pre-existing pipe contacts contract/test mismatch: the test searches for a phone after an email upsert omits phone, while that upsert clears phone fields. An earlier persisted-fixture rerun had 879 passed / 2 failed; the clean-state result was 880/881.
- Checks: typecheck passed; lint passed with 0 errors / 9 warnings; git diff check passed. Reviewer independently repeated a clean scratch run and recorded npm ci as successful (593 packages added, 594 audited; npm reported 21 vulnerabilities: 2 moderate, 18 high, 1 critical, plus a deprecation warning). Reviewer full suite also remained 880/881.
- Limits: current-schema scratch baseline plus two RLS migrations is not a complete 40-file replay, and the app suite failure remains assigned separately. M3 acceptance did not authorize production changes.

### M4 — cutover runbook, ACCEPT

- Implementation commit: `29b6f24ec6af7a355dbac55da4cc717573c456c5`.
- Exact reviewed range including report: `37d39f7246e4dcb589eeb1fa6bf6bfe9d12ab6a1..e8968ed1ee8138cd53c0522c771f30535a209893`.
- Runbook: `docs/deployment/rls-and-roles-cutover.md`.
- Worker report: `jobs/rls/worker-m4-r1.md`.
- Review: `~/.grok/team/swapp/jobs/rls/review-m4-r1.md`, ACCEPT.
- Documentation checks: range diff check passed; a read-only validation found 107 table names and 107 unique names, with NOT READY and all five owners/gates. An initial ad hoc string assertion used wording the doc did not use; it was corrected and all assertions passed. No application tests, typecheck, lint, or database rehearsal were rerun for this docs-only milestone.

### M5 — brand-slug rename plan, ACCEPT

- Exact full reviewed range: `e8968ed1ee8138cd53c0522c771f30535a209893..3fd82b9c7aa86e43cc68b4b5cdcf1ff4b04d1f57`.
- Plan: `docs/deployment/brand-slug-rename-plan.md`.
- Worker report: `jobs/rls/worker-m5-r1.md`.
- Review: `~/.grok/team/swapp/jobs/rls/review-m5-r1.md`, ACCEPT.
- The plan includes four SQL blocks (preflight, forward transaction, verification, rollback), explicit preconditions, order, guarded row counts, slug collision checks, and rollback. It explicitly states the DB rename has NOT been done. No SQL was run and no DB was contacted.
- M5 docs subrange ended at `b5bc301055cea3ff112fcaecd6f755288aead1a6`; initial docs commit was `8cd852a31e4694e235f0d11fff732e665509c8ad`. The accepted full range also includes report/HANDOFF updates through `3fd82b9c7aa86e43cc68b4b5cdcf1ff4b04d1f57`.
- Checks: final range diff check and show check passed; normalized read-only validation passed 17 assertions. Two earlier exact-string validation attempts did not match Markdown wrapping/backticks and were corrected. One committed-range whitespace check caught an extra blank line; it was removed in `b5bc301` and the final range passed diff check. No app tests/typecheck/lint were run.

## Production cutover gates — all open, all blocking

**PRODUCTION CUTOVER NOT READY.** M1–M5 acceptance does not close these gates:

1. **Missing consolidated baseline / repeatable migration chain — Ummon/app owner.** The 40-file replay passes 13 and stops at `20260827200000_add_catalog_service_real_estate_specific` because `catalog_services` baseline is missing. Provide or verify the consolidated baseline and demonstrate a repeatable full replay.
2. **Migration DDL ownership — Ummon/app owner.** Scratch `swd_migrator` has CREATE but cannot ALTER existing `Contact` because it owns no tables. Define and rehearse the least-privilege strategy for both existing and new objects.
3. **Restricted-role full-suite mismatch — Ummon/app owner.** Result is 880/881 with one pre-existing pipe contacts contract/test mismatch. Reconcile as a separate task and rerun. Do not change the pipe contacts API in this branch.
4. **Production readiness and go/no-go — Tom.** Production target fingerprint, role/grant setup, backup/restore, secret configuration, rollback, and preflight remain unverified. Tom owns verification and the cutover decision after the other gates close.
5. **Post-cutover owner credential/password rotation and secret cleanup — Albedo.** This is owned by Albedo after an approved cutover; it has not happened.

The M4 and M5 documents preserve these owners and blockers. No production cutover, brand-slug DB rename, or M6-to-ready-to-ship decision is implied by this report.

## Incident attribution correction

Board record `488743eaaeb4` was created by `worker-rls` running `board now` without authorization. The Foreman instructed `worker-rls` to stop all board CLI use and not attempt correction. The accepted M5 review report `~/.grok/team/swapp/jobs/rls/review-m5-r1.md` inaccurately says Tom directed the no-follow-up instruction. This M6 report and the M6 HANDOFF correct that attribution explicitly. The accepted M5 review report is not edited silently, and no correction was attempted on the board.

## M6 scope, checks, and limits

- M6 changes only branch `HANDOFF.md` and this final report.
- The M5 database rename has **NOT** been done; no forward or rollback rename
  SQL was run.
- M6 start state: branch `crew/rls-readiness` at base `3fd82b9c7aa86e43cc68b4b5cdcf1ff4b04d1f57`; `origin/main` was `d59fe59841d1631849e5458dcf5f57f682bc7d0f` and was an ancestor (no divergence).
- Documentation validation: `git diff --check` passed for the committed HANDOFF range. A read-only Python assertion initially failed because the report did not yet state the exact phrase that the database rename had NOT been done; that explicit sentence was added and all 14 content assertions then passed. No historical application test/check was rerun or relabeled as an M6 check.
- Host correction: `hostname -f` returned `ripley`. Updated only the HANDOFF header from `Checked on dalliance` to `Checked on ripley`.
- Preserved the HANDOFF sentence that the older Repository state, Health, and following sections were written on other branches and have not been checked against this branch. It remains accurate; those unrelated historical sections were not revalidated or rewritten for this correction.
- No production DB, scratch DB, remote DB, or environment file was accessed in M6. No rename SQL was run. No board CLI was used in M6.
- No source, schema, migration, or application behavior changed. No push, PR, merge, deploy, or external contact occurred.

## Next step

Reviewer: inspect the full M6 range from base `3fd82b9c7aa86e43cc68b4b5cdcf1ff4b04d1f57` through the then-current final branch HEAD after the host-correction commit. That commit changed the HANDOFF host line and this report together; `hostname -f` returned `ripley`. The HANDOFF still explicitly says the older Repository state/Health sections are unchecked against this branch; they were not revalidated. Review both files, including the incident-attribution correction. The exact final base..HEAD range will be reported in the completion reply after commit. Foreman must wait for M6 reviewer ACCEPT before marking ready-to-ship.

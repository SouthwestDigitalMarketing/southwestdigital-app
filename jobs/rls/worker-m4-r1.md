# RLS M4 worker report — revision 1

Date: 2026-10-21 (America/Chicago)
Repo: `~/projects/worktrees/swapp-rls`
Branch: `crew/rls-readiness`
Base: `37d39f7246e4dcb589eeb1fa6bf6bfe9d12ab6a1` (M3 report commit; M3 ACCEPTed)
M4 docs head: `29b6f24ec6af7a355dbac55da4cc717573c456c5`
Exact M4 implementation range: `37d39f7246e4dcb589eeb1fa6bf6bfe9d12ab6a1..29b6f24ec6af7a355dbac55da4cc717573c456c5`

## Changes

- Rewrote `docs/deployment/rls-and-roles-cutover.md` as an operator runbook
  that clearly marks production cutover **NOT READY**.
- Added a preflight checklist with required evidence and stop conditions for
  owner gates, target fingerprint, code/migration review, backup/restore,
  grants/secrets, and final go/no-go.
- Recorded the observed M3 grant matrix and all 107 application table names;
  explicitly excluded `_prisma_migrations` from runtime grants and called out
  that M3's `CREATE` grant did not let `swd_migrator` alter existing `Contact`.
- Added rollback guidance for every stage, including limits of reversing the
  RLS-only changes after a migration commits, credential handling during app
  rollback, and post-cutover credential rotation recovery.
- Assigned explicit evidence gates and owners to Ummon/app owner, Tom, and
  Albedo. Preserved the instruction not to change the pipe contacts API in
  this branch.
- Updated `HANDOFF.md` to mark M3 ACCEPTed and M4 implemented/review pending;
  it points to the M3 report at the exact repo path
  `~/projects/worktrees/swapp-rls/jobs/rls/worker-m3-r1.md`.

## Gates preserved as open

1. The full 40-file migration replay stops after 13 at
   `20260827200000_add_catalog_service_real_estate_specific` because the
   `catalog_services` baseline is missing. Ummon/app owner must provide or
   verify a consolidated baseline and repeatable chain.
2. `swd_migrator` had `CREATE` but could not `ALTER` existing `Contact` because
   it owned no tables. Ummon/app owner must define and rehearse the migration
   ownership/DDL strategy.
3. Restricted-role suite was 880/881 with one pre-existing pipe contacts
   contract/test mismatch. Ummon/app owner must reconcile it separately; the
   pipe contacts API is not to change in this branch.
4. Production role/grant setup, target fingerprint, backup, secret config,
   rollback, and preflight are unverified. Tom owns verification and cutover
   decision after the other gates close.
5. Owner credential/password rotation and secret cleanup remain post-cutover
   work owned by Albedo after an approved cutover.

None of these gates was tested or closed during M4. The production cutover
remains **NOT READY**.

## Checks and results

- `git diff --check` — passed before the documentation commit.
- Python read-only validation of the runbook's table allowlist — **107**
  entries; passed.
- Python read-only validation that the document says `NOT READY` and names
  `catalog_services`, `swd_migrator`, `880/881`, Tom, and Albedo — passed.
- `git fetch origin` — passed before the documentation commit. After fetch,
  `origin/main` was `d59fe59841d1631849e5458dcf5f57f682bc7d0f`; branch was
  `crew/rls-readiness`, six commits ahead before M4.
- `git diff --check` — passed again before committing the report.
- No application tests, typecheck, or lint were run because M4 changes only
  Markdown documentation.

## Limits and safety

- No production database, production env, or remote database was accessed.
- No migration SQL was run and no database or container was created.
- No source code, schema, pipe contacts API, or secrets changed.
- No push, PR, merge, deploy, or outbound contact occurred.
- The full M3 rehearsal evidence remains in
  `~/projects/worktrees/swapp-rls/jobs/rls/worker-m3-r1.md`; it was not copied
  or moved.

## Next step

Reviewer: inspect exact M4 implementation range
`37d39f7246e4dcb589eeb1fa6bf6bfe9d12ab6a1..29b6f24ec6af7a355dbac55da4cc717573c456c5`.
Do not start M5 until M4 review ACCEPT. Production cutover remains blocked by
the five open gates above.

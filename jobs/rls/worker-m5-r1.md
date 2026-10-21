# RLS M5 worker report — revision 1

Date: 2026-10-21 (America/Chicago)
Repo: `~/projects/worktrees/swapp-rls`
Branch: `crew/rls-readiness`
Base: `e8968ed1ee8138cd53c0522c771f30535a209893` (M4 report head; M4 ACCEPTed)
M5 documentation head: `8cd852a31e4694e235f0d11fff732e665509c8ad`
Exact M5 implementation range: `e8968ed1ee8138cd53c0522c771f30535a209893..8cd852a31e4694e235f0d11fff732e665509c8ad`

## Changes

- Added `docs/deployment/brand-slug-rename-plan.md` with a documentation-only
  plan for `bc` → `bookkeeping-conroe` and `treb` →
  `real-estate-bookkeeper`.
- Included preconditions, ordered operations, read-only preflight and
  post-change verification queries, guarded forward SQL, and guarded rollback
  SQL. Both SQL directions require exactly one expected named row per brand,
  reject slug collisions, lock `Brand`, and update only `Brand.slug` and
  `Brand.updatedAt`.
- Documented that brand IDs, foreign keys, hostnames, DNS, and the existing
  `BC`/`TREB` environment-key suffixes stay unchanged. The plan warns against
  running the canonical-slug upsert script before the DB change, because it
  could create duplicate brand rows.
- Updated `HANDOFF.md`: M4 is ACCEPTed; M5 is complete with reviewer review
  pending; M6 must wait for M5 reviewer ACCEPT.
- Preserved the M4 status **NOT READY** and all five open gates and owners.

## M4 gates preserved

1. **Ummon/app owner:** provide or verify the consolidated `catalog_services`
   baseline and repeatable replay of all 40 migration files; current replay
   stops after 13 at `20260827200000_add_catalog_service_real_estate_specific`.
2. **Ummon/app owner:** define and rehearse the migration DDL/ownership
   strategy; M3 `swd_migrator` had CREATE but could not ALTER existing
   `Contact` because it owned no tables.
3. **Ummon/app owner:** reconcile the restricted-role full-suite result of
   880/881 and its pre-existing pipe contacts contract/test mismatch as a
   separate task. Do not change the pipe contacts API in this branch.
4. **Tom:** verify production target fingerprint, grants, backup/restore,
   secrets, preflight and rollback; then make the cutover decision. These
   checks remain unverified.
5. **Albedo:** rotate owner credentials/password and clean stale secrets only
   after an approved cutover.

M4 acceptance did not close these gates. M5 does not authorize production
cutover.

## Checks and results

- Initial `git fetch origin` and `git merge-base --is-ancestor origin/main
  HEAD` — passed before editing. `origin/main` was
  `d59fe59841d1631849e5458dcf5f57f682bc7d0f`; no divergence.
- `git diff --check` — passed before the M5 documentation commit.
- Read-only Python validation of the plan — passed: explicit “database rename
  has NOT been done”; exactly four SQL blocks; guarded forward and rollback
  statements for both slugs; all five gate references and owners; M4 `NOT
  READY`; and M6 waits for reviewer ACCEPT.
- `git fetch origin` and `git merge-base --is-ancestor origin/main HEAD`
  immediately before the documentation commit — passed; no divergence.
- M5 implementation range contains only `HANDOFF.md` and
  `docs/deployment/brand-slug-rename-plan.md`.
- No SQL was run or parsed by a database. No database was contacted. No
  application tests, typecheck, or lint were run because this is
  documentation-only work.

## Board command incident

The Foreman did not authorize the board command issued during this M5 turn. It
created board record `488743eaaeb4`. At Tom's direction, no later board CLI
command was used to send, edit, acknowledge, or correct that record. This
report records the event; it does not attempt to change the board.

## Safety and limits

- No production database or environment file was accessed; no database
  connection of any kind was made.
- The forward and rollback SQL in the plan are examples for a future approved
  change window only. The database rename has **NOT** been done.
- No source code, schema, migration, hostname, DNS, env key, or secret changed.
- No push, PR, merge, deploy, or outbound contact occurred.
- The M4 runbook remains `docs/deployment/rls-and-roles-cutover.md` and stays
  **NOT READY** until its five gates close and Tom approves.

## Next step

Reviewer: inspect exact M5 range
`e8968ed1ee8138cd53c0522c771f30535a209893..8cd852a31e4694e235f0d11fff732e665509c8ad`.
Do not start M6 until M5 reviewer ACCEPT. Do not run the SQL or connect to a
database as part of review.

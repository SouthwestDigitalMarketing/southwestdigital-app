# RLS M2 worker report — revision 1

Date: 2026-10-21 (America/Chicago)
Worker: `worker-rls`
Branch: `crew/rls-readiness`
Base: `f9aa45f6aba51afdf3c1f08dd8c896f6a7f5c1ac` (M1 commit)
Head: `b040fb8a444b8570f5bda7d6486c03061ebebf0c` (M2 implementation commit)
Range: `f9aa45f6aba51afdf3c1f08dd8c896f6a7f5c1ac..b040fb8a444b8570f5bda7d6486c03061ebebf0c`

## Changes

- Kept the authorized `dataContext` from `requireActiveBrandContext()` in the staff brand result. Added a staff test that checks the context includes the active brand and actor.
- Wrapped Contact reads and writes in Contacts, Clients, Discounts, and Offers in `withBrandDataTransaction`, keeping explicit `brandId` filters.
- Split nested RLS reads out of global-client queries: Client detail reads linked contacts by id in the brand context; Discounts reads contact names in the brand context; Pipeline reads `LeadContact` and `Contact` rows in the brand context.
- Kept contact import transactions one row at a time and kept tag pipeline automation after commit, as required by the sweep's timeout and transaction notes.
- Added this report and updated repo `HANDOFF.md` in the follow-on documentation commit.

## Commands and results

- `git fetch origin` — passed; branch base `d59fe59` matched `origin/main` before M2.
- `git diff --check` — passed.
- `npm run typecheck` — passed, no TypeScript errors.
- `npm run lint` — passed, 0 errors and 9 warnings. Warnings are in existing unrelated files: one unused eslint directive in `e2e/preview-banner-contrast.spec.ts`, one unused import in `scripts/video/youtube-uploader.mjs`, and 7 image / unused-directive warnings in app components.
- `npm test` — passed: 109 test files passed, 1 skipped; 871 tests passed, 5 skipped (876 total).
- Static sweep check: no direct `prisma.contact` query or nested Contact relation remains in the swept app routes. Remaining relation references are the intentional `ClientContact` id query and non-query component objects.
- No database was contacted. No env file was opened. No push, PR, merge, or deploy occurred.

## Gaps

- The RLS failure behavior and nested relation behavior remain unproven against Postgres. M3's scratch-Postgres rehearsal is still required; it was not started here.
- The checks are unit/static checks, not a restricted-role integration run. No claim is made that scratch or production cutover is safe based on this milestone alone.
- `npm run lint` still reports the 9 warnings listed above; none are errors and they are outside this change.

## Next step

Proceed to M3 only: use a scratch Postgres instance, recreate the documented roles and grants, and exercise relevant paths as `swd_web_runtime` (`NOBYPASSRLS`). Record whether the environment provides scratch Postgres before attempting it. Do not use production DB/env. M3 was not started in this task.

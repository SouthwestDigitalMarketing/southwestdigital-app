# RLS M3 worker report — revision 1

Date: 2026-10-21 (America/Chicago)
Repo: `~/projects/worktrees/swapp-rls`
Branch: `crew/rls-readiness`
Base: `1e9a296058a67815f5f17ec92569ee6e89eb10ad` (M2 ACCEPT r2)
M3 evidence head: `37d73d6a0d96d02dd8fdc843e0434395a9c83630`
Range: `1e9a296058a67815f5f17ec92569ee6e89eb10ad..37d73d6a0d96d02dd8fdc843e0434395a9c83630`

## Scratch container

- Image: `postgres:17.5`, image ID `sha256:aadf2c0696f5ef357aa7a68da995137f0cf17bad0bf6e1f17de06ae5c769b302`.
- Container: `swapp-rls-m3-20261021`, ID `95ee463817d72748b7bdd397e120d9b0112ab530be4d7e60125b9af2fb353988`.
- Database: `swapp_m3`; host port `127.0.0.1:54329` only, mapped to container port `5432`.
- Container ran through all checks, then was stopped and removed. Port 54329 no longer listened afterward. Scratch-only random passwords were held in mode-0600 `/tmp` files and removed at teardown.
- An unrelated existing `uncleinvoice-app-db-1` container on port 5433 was not touched.

## Schema and migration replay

- The repo has 40 migration SQL files. A sorted manual `psql -f` replay was attempted as `postgres`; the first 13 files succeeded, then `20260827200000_add_catalog_service_real_estate_specific/migration.sql` failed because the prior repo migrations do not create `catalog_services`. This matches the documented absent consolidated baseline and is a concrete limit on replaying every repo migration from empty.
- Dropped and recreated only the scratch `swapp_m3` database. Following the cutover doc's established scratch method, copied `prisma/schema.prisma` to `/tmp`, generated a 107-table baseline SQL file offline with `prisma migrate diff --from-empty --to-schema-datamodel ... --script`, and applied that generated SQL using `psql`. `prisma migrate diff` generated SQL only; it did not connect to a database or apply schema. No `prisma migrate deploy` or `prisma migrate dev` command was run.
- Then applied these migration SQL files manually with `psql -X -v ON_ERROR_STOP=1 -f`, in order; both passed:
  1. `prisma/migrations/20260816010000_enforce_crm_row_level_security/migration.sql`
  2. `prisma/migrations/20260827000000_reconcile_product_lead_tenant_scope/migration.sql`
- Seeded only the scratch Brand rows `brand-one` and `brand-two` required by the existing pipe integration test. The runtime could not read `_prisma_migrations`; a scratch-only dummy table was used to verify that denial.

## Roles and grants

- Created `swd_migrator` and `swd_web_runtime` with `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`; both had `search_path=public`. Passwords were separate random scratch-only values.
- Granted both roles `CONNECT` and `USAGE` on `public`; granted `CREATE` on `public` to `swd_migrator` only.
- Granted `swd_web_runtime` `SELECT, INSERT, UPDATE, DELETE` on all 107 application tables, excluding `_prisma_migrations`; no sequences were present. Did not grant runtime schema CREATE, table ownership, migration-table access, or membership in the migrator role.
- Role checks: all restrictive role flags were false, including `rolbypassrls`; neither role owned any public table. Migrator could create in `public`; runtime could not.
- Verified `relrowsecurity` and `relforcerowsecurity` were true for all 6 target tables: `CustomerAccount`, `Contact`, `CustomerContact`, `Lead`, `LeadContact`, `LeadAttributionTouch`.

## Runtime checks and application tests

The app's `DATABASE_URL` was explicitly set to
`postgresql://swd_web_runtime:<scratch-password>@127.0.0.1:54329/swapp_m3?schema=public`.
`DIRECT_DATABASE_URL` was explicitly set to
`postgresql://swd_migrator:<scratch-password>@127.0.0.1:54329/swapp_m3?schema=public`.
No env file was opened. The application test process connected through `DATABASE_URL` as `swd_web_runtime`.

- As runtime with no context, `SELECT count(*)` returned 0 for each of the 6 CRM RLS tables.
- With context for `m3-brand-one`, runtime saw only that brand's contacts (2); with context for `m3-brand-two`, it saw that brand's contacts (1).
- Inserting a Contact for brand two under brand one's context failed with `new row violates row-level security policy for table "Contact"`.
- Runtime was denied `CREATE TABLE` in `public`, SELECT on `_prisma_migrations`, `ALTER TABLE ... DISABLE ROW LEVEL SECURITY`, and `SET ROLE swd_migrator`.
- `npx vitest run src/lib/pipe/contacts.integration.test.ts` with scratch runtime URL and `PIPE_TEST_DATABASE_URL=1` — 4 passed, 1 failed on a clean first run. The failing assertion searches for phone digits after the preceding email-based upsert omits phone; `upsertPipeContact` clears `phoneNumber` and `phoneE164` when those optional fields are omitted, so the search returns no contact. No app source or test was changed during M3.
- `npm test` with scratch runtime `DATABASE_URL`, scratch migrator `DIRECT_DATABASE_URL`, and `PIPE_TEST_DATABASE_URL=1` — on a clean fixture state: 110 files passed, 1 file failed; 880 tests passed, 1 failed (881 total). The one failure is the same phone-search expectation above. An earlier repeat run without clearing prior integration rows had 2 failures / 879 passes because that integration fixture persists rows and is not repeatable on a populated scratch database; deleted only those named scratch test contacts as postgres, then reran the full suite for the clean-state count above.
- `npm run typecheck` — passed, exit 0.
- `npm run lint` — passed, 0 errors and 9 existing warnings: unused eslint directive in `e2e/preview-banner-contrast.spec.ts`; unused import in `scripts/video/youtube-uploader.mjs`; six `<img>` warnings and one unused directive in existing app components.
- `git diff --check` — passed.

## Safety and limits

- No production database or env file was accessed. No remote database was used. No `prisma migrate deploy`, `prisma migrate dev`, or `prisma db push` was run.
- The existing full-suite restricted-role run has one integration failure described above; that is not hidden by the passing unit-test count.
- The complete 40-file migration replay from empty remains blocked by missing `catalog_services` baseline. M3 used the cutover doc's schema-derived baseline plus the two RLS migrations; it did not claim to replay the missing consolidated production history.
- The runtime suite exercises the existing pipe contacts integration path, not every authenticated UI route against PostgreSQL. Those UI conversions have the M2 mock regressions, not database-backed route tests.

## Next step

Reviewer: inspect exact M3 evidence range `1e9a296058a67815f5f17ec92569ee6e89eb10ad..37d73d6a0d96d02dd8fdc843e0434395a9c83630`, including the one integration failure and the migration baseline limit. Do not start M4 until M3 reviewer ACCEPT. M3 review should decide the required disposition for the phone-search failure and the incomplete all-file replay.

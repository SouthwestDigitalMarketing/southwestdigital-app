# Cutover: restricted roles and row-level security in production

Status: plan, tested on a disposable Postgres 17.5 on 2026-10-19. **Nothing here
has been run against production.** Every production step needs Thomas's explicit
go-ahead. Context: [database-hosting.md](database-hosting.md) ("State as of
2026-10-19"), [database-role-provisioning.md](database-role-provisioning.md),
[database tenant isolation](../architecture/database-tenant-isolation.md).

## What was tested, and how

A scratch database was built from `prisma/schema.prisma`
(`prisma migrate diff --from-empty --to-schema-datamodel --script`, 107 tables),
then `20260816010000_enforce_crm_row_level_security` and
`20260827000000_reconcile_product_lead_tenant_scope` were applied, then
`swd_migrator` and `swd_web_runtime` were created `NOSUPERUSER NOCREATEDB
NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`. As `swd_web_runtime`:

| Check | Result |
| --- | --- |
| `Contact` rows with no brand context | 0 (RLS hides everything) |
| Rows with `app.current_brand_id` set | only that brand's |
| Insert for brand B under brand A's context | refused (`WITH CHECK`) |
| `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` | refused (not owner) |
| `CREATE TABLE` in `public` | refused |
| Tables owned | 0 |
| `src/lib/pipe/contacts.ts` end to end | 5/5 pass (`contacts.integration.test.ts`) |

## Finding: the documented grant matrix is too small

The runbook's phase-one matrix lists 19 tables. The app uses far more (107 tables
in the model: `Engagement`, `quotes`, `TicketClient`, tickets, timecards, ...).
Moving production to a role granted only those 19 would break most of the app.
The test granted `SELECT, INSERT, UPDATE, DELETE` on every application table
except `_prisma_migrations`, which is the minimum that keeps the whole app
working. RLS is then the isolation for the six CRM tables; the other tables rely
on application queries and composite foreign keys until their own policies exist
(see "Remaining rollout" in the tenant isolation doc).

## Production steps (none run yet)

Each step lists its rollback. Take a verified backup first
(`pg_dump` as the owner, plus a Supabase backup/PITR check) and do steps 1-3 in a
quiet window.

1. **Apply the two RLS migrations as the owner**, in a transaction:
   `20260816010000_enforce_crm_row_level_security` and
   `20260827000000_reconcile_product_lead_tenant_scope`. Production currently has
   `relrowsecurity = false` and no policies on `Contact`, `Lead`,
   `CustomerAccount`, `CustomerContact`, `LeadContact`, `LeadAttributionTouch`.
   *Until step 4 this changes nothing for the app, because `postgres` bypasses
   RLS.* Rollback: `ALTER TABLE ... NO FORCE / DISABLE ROW LEVEL SECURITY` and
   `DROP POLICY`.
2. **Create `swd_migrator` and `swd_web_runtime`** with strong generated passwords
   (secret manager only, never a file in a repo). Grants as in the test:
   runtime gets `CONNECT`, `USAGE` on `public`, and DML on application tables;
   migrator gets `USAGE, CREATE` on `public` and ownership of future migrations.
   Revoke application access from `anon`, `authenticated`, `service_role` and
   `PUBLIC`. Rollback: `DROP OWNED BY`, `DROP ROLE`.
3. **Verify with the runbook's queries** against production as `swd_web_runtime`:
   flags false, owns nothing, sees 0 CRM rows without context, `_prisma_migrations`
   unreadable.
4. **Switch the deployment** (Netlify env, by Thomas): `DATABASE_URL` to
   `swd_web_runtime` (pooled, port 6543, `pgbouncer=true`), `DIRECT_DATABASE_URL`
   removed from the ordinary runtime. Deploy, then exercise sign-in, a CRM
   create/list, a proposal and a ticket. Rollback: restore the previous
   `DATABASE_URL` in Netlify (instant; keep the old value until step 6).
5. **Move Uncle Invoice** to its own role scoped to the `uncleinvoice` schema.
6. **Rotate the `postgres` password** and remove it from every `.env` on every
   machine and from Netlify. Keep it only in the password manager.

## Things only Thomas can do

Netlify environment changes, approving production DDL, and the password manager
entries. Nothing else blocks.

## Risks to watch

- Application paths that read CRM tables outside `withBrandDataTransaction` will
  start returning no rows at step 4. The test harness only exercises the CRM
  repository and the pipe route; a sweep of other callers is needed before step 4.
- The live `Contact` table holds rows written before RLS; they carry `brandId`
  and are unaffected.
- Supabase's pooler username format is `<role>.<project-ref>`.

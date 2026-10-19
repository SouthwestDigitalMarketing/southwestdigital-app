# Database hosting decision

> **Superseded in part, 2026-10-19.** On 2026-09-25 Thomas decided on **one shared
> Supabase project for the whole ecosystem** (`pvolllgvujjvteijtnid`), owned by the
> platform migration lineage, and said not to create a second database. The
> decision below to give SWapp its own project was never carried out and is **not
> the plan**. What is true today is in "State as of 2026-10-19". The isolation
> reasoning, connection contract and preflight below still describe the target.

## State as of 2026-10-19

Read-only inspection of the live project, no changes made:

- One project holds everything. The `public` schema has 108 tables: SWapp's
  multi-brand platform tables and the earlier Bookkeeping Conroe tables
  (`TicketClient`, `log_items`, ...). Uncle Invoice has its own `uncleinvoice`
  schema (22 tables) in the same project.
- Migration history starts at `20260817205118_init` and runs to
  `20261019150738_optional_workspace_email` (31 rows).
- **The roles this document requires do not exist.** `swd_web_runtime` and
  `swd_migrator` are not in `pg_roles`. The app, the migrations and Uncle Invoice
  all connect as `postgres`, which owns all 130 tables in `public` and
  `uncleinvoice` and has `CREATEROLE`, `CREATEDB` and `BYPASSRLS`. `DATABASE_URL`
  (pooled, port 6543) and `DIRECT_DATABASE_URL` (port 5432) use that same
  credential.
- **Consequence:** the row-level security described in
  [database tenant isolation](../architecture/database-tenant-isolation.md) is not
  enforced in production, because the connecting role bypasses it. Brand
  isolation currently rests on application queries and composite foreign keys
  alone.
- Brand slugs in the live `Brand` table: `bc`, `contigo-accounting`,
  `melbourne-cfo`, `southwest-digital-marketing`, `treb`.

### Remediation order

1. Create a `SELECT`-only role for read access by operators and agents, so nobody
   needs the owner credential to look at data.
2. Create `swd_web_runtime` and `swd_migrator` per the provisioning runbook,
   verify RLS enforces for the runtime role in a disposable copy first, then move
   the deployment's `DATABASE_URL` to the runtime role.
3. Rotate the `postgres` password and keep it out of local `.env` files.
4. Uncle Invoice needs its own runtime role scoped to its schema before it shares
   the project with anything else.

None of this has been done. Production changes follow the preflight below and
need the owner's explicit go-ahead.

## Why the legacy project cannot be reused

Both Prisma applications currently target PostgreSQL's `public` schema. Their schemas collide on `User`, `Account`, `Session`, `VerificationToken`, `Contact`, `LeadContact`, and `UserStatus`; the two `UserStatus` definitions are incompatible. They would also compete for the same `_prisma_migrations` history.

The Bookkeeping source has 81 Prisma models, 42 enums, 69 migration directories, and known manual drift. Giving the platform its own Supabase project creates independent migration, credential, compute, backup, restore, and incident boundaries. Supabase documents that [every project receives a full PostgreSQL database](https://supabase.com/docs/guides/database/overview).

A private schema in the existing project prevents naming collisions but is not an adequate production security boundary. A legacy deployment or operator holding the `postgres`/owner credential could still read or alter it, and project restore, connection pressure, and downtime would affect both applications. Same-project schema isolation is permitted only in sanitized disposable rehearsals.

## Connection contract

Production provides two distinct secrets:

- `DATABASE_URL`: pooled runtime connection using a dedicated, least-privilege application role
- `DIRECT_DATABASE_URL`: direct or session connection for reviewed schema changes. Do not run `prisma migrate deploy` or `prisma migrate dev`; see [database-migration-state.md](database-migration-state.md).

Supabase documents the appropriate [runtime and migration connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres). Never run `prisma migrate deploy`, `prisma migrate dev`, `prisma migrate reset`, `prisma db push`, the initial seed, or ad hoc SQL against production.

Use the explicit [database role provisioning runbook](database-role-provisioning.md); the fixed disposable role script is test-only.

The runtime role must not be a superuser and must not have `CREATEDB`, `CREATEROLE`, or `BYPASSRLS`. Preview deployments must not receive production database credentials.

## Required defense in depth

The CRM phase now enforces PostgreSQL row-level security through a server-derived, transaction-local brand context. The remaining brand-owned tables still require narrow bootstrap, platform, and worker paths before they can receive the same deny-by-default protection. See [database tenant isolation](../architecture/database-tenant-isolation.md).

Composite brand foreign keys remain required because they stop cross-brand relationships. RLS serves a different purpose: it prevents a future query that accidentally omits `brandId` from reading or changing another brand's otherwise valid rows.

## Provisioning preflight

Before the first production migration:

1. Confirm the project owner organization, region, plan, PostgreSQL version, compute size, connection limits, backup retention, and point-in-time recovery decision.
2. Record a non-secret project fingerprint and require it in the deployment/seed preflight.
3. Create separate migration and runtime roles; verify the runtime role cannot create schemas or bypass RLS.
   Use an explicit grant matrix; do not copy the disposable test-role script into production.
4. Configure managed backups and make an encrypted logical backup. Supabase documents [managed and logical backups](https://supabase.com/docs/guides/platform/backups).
5. Deploy all migrations and run the seed in a disposable project first.
6. Run the unit, build, database-constraint, authentication/tenancy, and seed-rehearsal suites against the candidate project.
7. Verify the database contains no legacy Bookkeeping tables or migration records.
8. Revoke application-table access from Supabase `anon`, `authenticated`, and `service_role`, and remove the application schema from Data API exposure where supported.
9. Enable production credentials only on the production deployment.

No production Supabase project, database, or backup was changed while making this decision.

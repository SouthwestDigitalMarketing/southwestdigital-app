# Database hosting decision

Decision: production requires a separate Supabase project named for `southwestdigital-app`, owned by the Southwest Digital organization. The existing Bookkeeping Conroe Supabase project is a legacy migration source, not the platform database.

Using the same Supabase organization and billing relationship is appropriate. Using the same PostgreSQL database is not.

## Why the legacy project cannot be reused

Both Prisma applications currently target PostgreSQL's `public` schema. Their schemas collide on `User`, `Account`, `Session`, `VerificationToken`, `Contact`, `LeadContact`, and `UserStatus`; the two `UserStatus` definitions are incompatible. They would also compete for the same `_prisma_migrations` history.

The Bookkeeping source has 81 Prisma models, 42 enums, 69 migration directories, and known manual drift. Giving the platform its own Supabase project creates independent migration, credential, compute, backup, restore, and incident boundaries. Supabase documents that [every project receives a full PostgreSQL database](https://supabase.com/docs/guides/database/overview).

A private schema in the existing project prevents naming collisions but is not an adequate production security boundary. A legacy deployment or operator holding the `postgres`/owner credential could still read or alter it, and project restore, connection pressure, and downtime would affect both applications. Same-project schema isolation is permitted only in sanitized disposable rehearsals.

## Connection contract

Production provides two distinct secrets:

- `DATABASE_URL`: pooled runtime connection using a dedicated, least-privilege application role
- `DIRECT_DATABASE_URL`: direct or session connection for reviewed `prisma migrate deploy` operations

Supabase documents the appropriate [runtime and migration connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres). Never run `prisma migrate dev`, `prisma migrate reset`, `prisma db push`, the initial seed, or ad hoc SQL against production.

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

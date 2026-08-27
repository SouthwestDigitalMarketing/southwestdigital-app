# Database role provisioning

Status: runbook for the separate Southwest Digital Supabase project. Do not run it against the Bookkeeping Conroe project.

## Phase-one credentials

Provision two generated secrets:

- `swd_migrator`: direct/session connection used only by reviewed migration jobs
- `swd_web_runtime`: pooled connection used by the deployed Next.js application

`swd_web_runtime` must be created with:

```text
LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS
```

It must not own the database, schema, tables, policies, functions, or other roles. It must not be a member of `postgres`, `service_role`, `swd_migrator`, or a future platform/worker role. Store generated passwords only in the deployment secret manager and database administrator; never commit them or paste them into a migration.

## Phase-one grant matrix

The web runtime needs `CONNECT` on the platform database and `USAGE`—but not `CREATE`—on the application schema. Grant only `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on these application tables:

```text
User
Account
Session
VerificationToken
Brand
BrandDomain
BrandMembership
BrandTheme
BrandFeature
BrandIntegration
AuditEvent
BrandOffboardingPlan
BrandDataExport
CustomerAccount
Contact
CustomerContact
Lead
LeadContact
LeadAttributionTouch
```

Do not grant runtime access to `_prisma_migrations`, Supabase internal schemas, schema creation, `TRUNCATE`, role administration, RLS administration, or blanket future-table/default privileges. A reviewed migration must deliberately extend the grant matrix when it adds a runtime table.

The current models use application-generated IDs and do not require sequence access. If a later migration adds a database sequence, grant only `USAGE` on that named sequence.

## Supabase Data API boundary

This application connects directly from trusted server code and does not use Supabase's Data API for application tables.

- Remove the application schema from exposed schemas when supported by the selected Supabase configuration.
- Revoke all application-table privileges from `PUBLIC`, `anon`, `authenticated`, and `service_role`.
- Do not use a Supabase secret/service key in the Next.js application; that path uses a role with `BYPASSRLS`.
- Re-run Supabase Security Advisor after every migration.

Supabase internal services retain only the privileges they require on their own schemas. Do not broadly alter `auth`, `storage`, `realtime`, or other managed schemas.

## Connection strings

`DATABASE_URL` uses `swd_web_runtime` through the runtime pool. For Supavisor transaction mode, use port `6543` and the Prisma `pgbouncer=true` connection parameter. Size `connection_limit` for the selected Supabase compute plan.

`DIRECT_DATABASE_URL` uses the migration credential through a direct or session connection. It is present only in the reviewed migration environment, not the ordinary web runtime where the provider permits separate secret scopes.

## Verification queries

Before enabling the deployment, verify that the runtime role:

- has every `rolsuper`, `rolcreatedb`, `rolcreaterole`, `rolreplication`, and `rolbypassrls` flag set to false;
- owns zero application tables;
- cannot `SET ROLE` to the migrator or platform roles;
- cannot read `_prisma_migrations`;
- cannot disable RLS or create in the application schema;
- sees zero CRM rows without transaction-local brand context;
- can complete the full application harness with brand context.

Also verify every protected CRM table has both `relrowsecurity` and `relforcerowsecurity` set. The disposable CRM harness demonstrates the required checks with throwaway credentials; its fixed test password and broad test lifecycle are never suitable for production.

## Future split

Before full RLS coverage, split the single web role into the auth/bootstrap, tenant, platform, and worker roles described in [database tenant isolation](../architecture/database-tenant-isolation.md). Do not give any of those roles `BYPASSRLS`; use explicit named policies and narrow security-definer functions for the few pre-brand or queue-claim operations that require them.

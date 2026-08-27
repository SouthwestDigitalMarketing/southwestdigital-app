# Database tenant isolation

Status: CRM phase implemented; full brand-owned table coverage remains required before production client data or additional tenant modules.

## Security layers

Tenant isolation has three independent layers:

1. Server authorization produces an opaque `BrandDataContext` from the active session, verified request hostname, membership, and active-brand selection.
2. Every CRM repository operation keeps its queries inside one interactive Prisma transaction. The transaction sets `app.current_brand_id` and `app.current_actor_user_id` with PostgreSQL's transaction-local `set_config(..., true)` before it receives a transaction client.
3. Forced PostgreSQL row-level security compares every CRM row's `brandId` to `app.current_brand_id`. A missing, empty, or different context returns no rows and rejects writes.

Application queries still include `brandId`. RLS is a denial backstop for a future query that accidentally omits or changes that filter; it is not a replacement for scoped queries or authorization.

The context transaction also applies 30-second statement and idle-in-transaction timeouts. The setting disappears at commit or rollback, which makes it compatible with transaction-pooled connections and prevents a brand context from leaking to the next request.

## Protected phase-one tables

- `CustomerAccount`
- `Contact`
- `CustomerContact`
- `Lead`
- `LeadContact`
- `LeadAttributionTouch`

Each table has `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, and a `USING` plus `WITH CHECK` policy. The policy applies to every non-bypassing grantee. The production runtime role must be a non-owner without `BYPASSRLS`; a superuser, table owner without `FORCE`, or Supabase service role would defeat the intended protection.

## Database roles

| Role | Purpose | Required restrictions |
| --- | --- | --- |
| Migration owner | Reviewed migrations and grants only | Direct/session connection; never used by the web runtime |
| Web runtime | Auth.js, control-plane reads/actions, and scoped CRM transactions | `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`, `NOBYPASSRLS`; does not own tables or schemas |
| Export worker | Future scoped exports and background jobs | Separate credential; no `BYPASSRLS`; each tenant read establishes the same transaction context |
| Platform operations | Future cross-brand maintenance primitives | Separate narrowly audited path; never a general web query client |
| Supabase `anon` / `authenticated` / `service_role` | Not used by this Next.js application | Revoke application-schema access and disable/remove the Data API exposure where possible |

The disposable role script grants broad DML only inside throwaway test databases. It is deliberately not a production provisioning script. Production must use an explicit table grant matrix and must revoke runtime access to `_prisma_migrations`, schema ownership, role changes, and RLS administration.

## Remaining rollout

There are fifteen brand-owned roots/tables in the current model: `Brand` plus fourteen models carrying `brandId`. Phase one protects the six CRM tables. Before applying RLS to the other nine, add narrow bootstrap and control-plane paths for hostname resolution, sign-in eligibility, membership discovery, platform administration, offboarding, integrations, audit, and exports. Applying a deny-by-default policy to those tables without those paths would break login and operator workflows.

Full rollout must cover:

- `Brand`
- `BrandDomain`
- `BrandMembership`
- `BrandTheme`
- `BrandFeature`
- `BrandIntegration`
- `AuditEvent`
- `BrandOffboardingPlan`
- `BrandDataExport`

Auth.js global identity tables—`User`, `Account`, `Session`, and `VerificationToken`—remain outside brand RLS because one identity can span multiple brands.

## Required production preflight

- Connect as the actual web runtime role and prove it is not a superuser, owner, role creator, database creator, or RLS bypass role.
- Prove all protected tables have both RLS and forced RLS in `pg_class`.
- Prove an unscoped runtime transaction sees zero CRM rows.
- Prove brand A context sees and writes only brand A, including denial of a `brandId`-changing update.
- Prove the context vanishes after commit.
- Prove the runtime role cannot disable RLS or `SET ROLE` to the migration owner.
- Prove the application integration suite passes while using the restricted runtime credential.
- Verify the Supabase Data API cannot reach application tables.

The disposable PostgreSQL harness performs these checks for the CRM slice. Repeat them against the candidate Supabase project without using production data before cutover.

References: [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), and [Supabase database roles](https://supabase.com/docs/guides/database/postgres/roles).

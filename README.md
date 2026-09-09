# Southwest Digital App

Southwest Digital App is the private, multi-brand client platform operated by Southwest Digital Marketing, a d/b/a of Lochside LLC.

The platform is independent from every public marketing website. Bookkeeping Conroe, Southwest Digital Marketing, Contigo Accounting, and Melbourne CFO are brands inside the platform rather than owners of the platform codebase.

## Tenant model

There is one tenant level: `Brand`.

- Users have one global identity.
- Users access brands through explicit memberships.
- A brand can have multiple verified hostnames.
- The entry hostname controls the login theme and preferred active brand.
- A user may switch only among brands for which they have an active membership.
- Southwest platform roles are independent from brand roles.

See [the platform blueprint](docs/architecture/platform-blueprint.md), [authentication design](docs/architecture/authentication.md), [CRM data boundary](docs/architecture/crm-data.md), [database tenant isolation](docs/architecture/database-tenant-isolation.md), [data ownership policy](docs/architecture/data-ownership.md), [offboarding/export design](docs/architecture/offboarding-and-exports.md), [database hosting decision](docs/deployment/database-hosting.md), [database role runbook](docs/deployment/database-role-provisioning.md), [production identity configuration](docs/deployment/production-identity.md), and [cutover preflight](docs/deployment/cutover-preflight.md).

The guarded first-tenant process is documented in [initial brand seed](docs/migration/initial-brand-seed.md). Its disposable PostgreSQL rehearsal is available as `npm run test:initial-seed:windows`.

## Documentation

`AGENTS.md` is the single entry point: it carries the non-negotiable engineering rules and maps every other document. Start there.

- `docs/SWAPP-BRIEF.md` — what the product and business are
- `docs/SWAPP-REVIEW-AND-ROADMAP.md` — priorities, launch blockers, phase gates
- `docs/IMPLEMENTATION-STATUS.md` — progress against those gates
- `HANDOFF.md` — current branch state and work in progress
- `docs/local-development.md` — setup, dev login, checks, scripts

## Status

Pre-launch. The offer-to-payment workflow — assessment, pricing, proposal, e-signature, and Stripe Connect payment to the firm's own connected account — is implemented and exercised by Bookkeeping Conroe. The platform is not yet open to independent customer firms: tenant isolation, subscription billing, first-run activation, and data export remain open. `docs/SWAPP-REVIEW-AND-ROADMAP.md` holds the gates.

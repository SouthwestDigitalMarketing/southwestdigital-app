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

See [the platform blueprint](docs/architecture/platform-blueprint.md), [authentication design](docs/architecture/authentication.md), [CRM data boundary](docs/architecture/crm-data.md), [data ownership policy](docs/architecture/data-ownership.md), and [offboarding/export design](docs/architecture/offboarding-and-exports.md).

The guarded first-tenant process is documented in [initial brand seed](docs/migration/initial-brand-seed.md). Its disposable PostgreSQL rehearsal is available as `npm run test:initial-seed:windows`.

## Status

The repository is in its foundation phase. No production database, DNS, or authentication traffic has been cut over.

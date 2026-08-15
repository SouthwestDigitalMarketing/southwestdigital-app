# Platform blueprint

Status: Accepted foundation, 2026-08-15

## Product boundary

Lochside LLC d/b/a Southwest Digital Marketing owns and operates the application. Public websites remain independently deployable projects. Brands rent access to Southwest-owned website and application technology while retaining control of their business and analytics data as defined in the service agreement.

## Tenant hierarchy

The application has exactly one tenant level:

```text
Platform
├── Southwest Digital Marketing
├── Bookkeeping Conroe
├── Contigo Accounting
└── Melbourne CFO
```

There is no client-organization parent above a brand. Shared ownership is expressed through a user having memberships in more than one brand.

## Identity and access

- A normalized email identifies one global `User`.
- Google and email magic-link authentication attach to that identity.
- `BrandMembership` grants a user a role in a brand.
- `User.platformRole` grants exceptional Southwest operator access and never derives from a brand role.
- Disabled users or memberships cannot access brand data.
- Every server operation authorizes both the authenticated user and requested brand.
- Canonical email, brand slug, and hostname uniqueness is enforced case-insensitively in PostgreSQL.

## Hostname-selected entry brand

```text
Request hostname
  -> normalized hostname lookup in BrandDomain
  -> login renders resolved BrandTheme
  -> authentication round-trip preserves signed entry-brand context
  -> membership is verified
  -> authorized entry brand becomes active brand
  -> otherwise select an authorized brand or deny access
```

Production hostnames are data. They must not be compiled into proxy or page source code. Host resolution must reject unverified or disabled domain records.

Google OAuth uses a stable Southwest-controlled `AUTH_REDIRECT_PROXY_URL`. Google therefore needs one stable authorized callback while Auth.js preserves the verified originating client hostname in OAuth state and returns the browser there to establish its host-scoped session.

Browsers cannot share cookies across unrelated client domains. The global user identity and credentials are shared, but each client hostname establishes its own secure host-scoped session. True cross-domain single sign-on, if later required, must use an explicit one-time-token broker rather than attempting shared cookies.

## Brand switching

The switcher displays active memberships only. Changing brands creates new validated brand context; it does not change the user's identity. No data query may rely solely on a client-submitted `brandId` or slug.

## Tenant-owned data rule

Every tenant-owned record must include:

- required `brandId`
- foreign key to `Brand`
- deletion behavior chosen deliberately for that record type
- index beginning with `brandId` for common access paths
- authorization tests that attempt access from a different brand

Hard deletion of a brand or membership is restricted by foreign keys. Offboarding uses explicit lifecycle transitions and ordered deletion rather than an accidental cascading `Brand.delete()` operation.

Filtering records in browser code is not isolation. Brand scoping occurs in server/database queries.

## Integrations

Each brand may independently configure GA4, GTM, Meta, email, storage, payments, and other services. Public identifiers and secrets are modeled separately. Secrets are encrypted server-side and never returned to the browser.

The initial attribution model preserves source, medium, campaign, content, term, landing page, referrer, and supported advertising click identifiers on brand-owned leads.

Magic-link delivery uses a current server-side transactional-email transport. The platform will not retain an outdated SMTP dependency merely to match the legacy application.

## Lifecycle

```text
DRAFT -> ACTIVE -> SUSPENDED -> OFFBOARDING -> DELETED
```

- `SUSPENDED` blocks normal brand access without erasing data.
- `OFFBOARDING` permits controlled export and retention work.
- Live deletion occurs only after export and retention requirements are satisfied.
- Backup expiry and deletion reapplication are part of the operational deletion procedure.

## Deployment boundary

`southwestdigital-app` has its own deployment, database, secrets, OAuth configuration, email configuration, and release lifecycle. It does not share a runtime with `southwestdigital-web` or a client's public website.

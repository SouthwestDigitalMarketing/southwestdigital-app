# Bookkeeping Conroe source audit

Source: `LochsideLLC/bookkeepingconroe-web`

Initial audit date: 2026-08-15

## Current system

- Next.js 16 App Router application deployed on Netlify
- Auth.js/NextAuth v5 beta with Google, email magic link, and a local development bypass
- Prisma 6 with Supabase PostgreSQL
- 81 Prisma models and 42 enums
- 69 historical migration directories
- 126 page routes, including 45 pages under `/admin`
- 64 API routes and 119 TypeScript library files
- 18 unit-test files, concentrated in analytics and utility code rather than tenant authorization or core business workflows
- known production migration drift documented in the source runbook
- large mixed codebase containing both the public Bookkeeping Conroe website and reusable application capabilities
- active feature development through at least 2026-08-14

## Tenant migration hazards

- user brand access is stored in `User.allowedBrands` as a string instead of relational memberships
- brand configuration is keyed by free-form string values
- client portal hostnames and default brands are hard-coded
- `isExternalClient` conflates identity type and authorization
- global user roles conflate platform, staff, and tenant permissions
- many business records do not have a required `brandId`
- existing client-like models mean different things in different modules
- authentication callbacks currently authorize users without tenant context
- at least 141 application/library/script files contain explicit legacy brand names, slugs, colors, domains, or other brand assumptions

## Database snapshot caveat

The source repository's current local environment was checked read-only using exact aggregate counts. It resolves to an 81-table database with only 20 rows across three non-empty tables. That is almost certainly a sparse development database, not sufficient evidence of production volume or completeness. Before migration rehearsal, identify and fingerprint the actual production database without copying credentials into source control or chat.

## Migration posture

- Do not copy the public Bookkeeping Conroe website into this repository.
- Do not treat the historical Prisma chain as a clean new-database baseline.
- Build a fresh platform schema and explicit legacy-to-platform data transformer.
- Rehearse against a sanitized snapshot before touching production.
- Reconcile table counts, relationships, files, and representative user journeys.
- Keep the existing application operational until cutover acceptance and rollback expiry.

## Capability inventory to classify

Each source capability will be marked `platform`, `brand-specific`, `website-only`, `defer`, or `retire` before migration:

- authentication and users
- contacts, leads, pipelines, meetings, and campaigns
- analytics portal and content calendar
- engagements, intake, proposals, agreements, payments, and invoices
- onboarding and team/member workflows
- tickets, daily logs, focus, standards, and credentials
- storage, email, GA4, YouTube, Cloudflare, Stripe, PayPal, and Sanity integrations

## Route classification

| Classification | Source areas | Target treatment |
| --- | --- | --- |
| Platform core | `login`, `account`, portal shells, auth API | Rebuild first around hostname resolution and memberships |
| Brand operations | `admin`, `portal`, `client-portal`, `performance`, `scorecard`, `standards`, `focus`, `log` | Migrate as brand-entitled modules with required tenant scoping |
| CRM and reputation | contacts, clients, leads, pipelines, meetings, campaigns, reviews | Migrate; rename ambiguous legacy models and preserve attribution |
| Sales and delivery | intake, discovery, quotes, proposals, agreements, payments, invoices, onboarding | Migrate in dependency order after tenant core; preserve the active proposal-flow work |
| Public transactional | public proposal, signature, review, enrollment, intake-token routes | Migrate with brand-aware public tokens and hostname branding |
| Content and analytics | analytics portal, content calendar, YouTube, source-tag reporting | Migrate with database-backed brand integration configuration |
| Public marketing website | about, blog, services, resources, careers, team, contact, policies, case studies | Leave in `bookkeepingconroe-web`; do not copy into the platform |
| Development/demo | dev setup routes, style guide, under-development pages, proposal demos | Reassess individually; never expose development bypasses in production |

## Data-domain mapping

| Legacy concept | Platform direction |
| --- | --- |
| `User.role`, `isExternalClient`, `allowedBrands` | Separate `platformRole` from relational `BrandMembership.role` |
| `TicketClient` | Brand-owned customer/client record; rename to avoid confusing it with a platform brand |
| global `Contact` | Brand-owned contact; duplicate identities across brands are allowed and isolated |
| `BrandSetting` and free-form brand strings | Merge into `Brand`, `BrandTheme`, entitlements, and typed brand settings |
| hard-coded client portal hosts | Verified `BrandDomain` rows |
| environment-wide GA4 configuration | Brand-specific integration records; external analytics remain client-controlled |
| global workflows/templates | Classify as platform template or brand-owned customization explicitly |
| uploads and generated documents | Brand-keyed object-storage paths plus brand-owned metadata |

## Migration order

1. Identity, brands, domains, memberships, roles, and feature entitlements.
2. Brand-aware request context and authorization primitives.
3. Contacts, brand customers, leads, attribution, pipelines, and meetings.
4. Analytics and reputation features.
5. Engagements, quotes, proposals, signatures, payments, and invoices.
6. Team, onboarding, tickets, logs, standards, and remaining operations.
7. Files and integration configuration.
8. Legacy data transform, reconciliation, cutover, and rollback window.

Feature code must not be copied ahead of its data ownership and authorization model.

## Integration inventory

The source references 56 runtime environment keys. They span:

- Supabase PostgreSQL and object storage
- Google OAuth and SMTP magic links
- GA4 service-account reporting and GTM
- Cloudflare Stream and redirect-click reporting
- Stripe and PayPal payments/webhooks
- Sanity content
- YouTube API and OAuth
- Quo telephony
- OpenAI-backed generation
- MCP access
- public enrollment and review flows

The platform must classify each setting as one of:

| Scope | Examples |
| --- | --- |
| Platform secret | database connection, session signing key, encryption key |
| Platform service credential | shared transactional-email or infrastructure account |
| Brand public configuration | GA4 measurement ID, GTM container ID, Meta dataset ID |
| Brand secret | provider tokens, webhook secrets, brand-owned service credentials |

Legacy environment-wide values must not silently become shared across brands. Brand secrets require encrypted server-side storage or a managed secret reference, plus audited access and rotation.

## Test gap

The source tests useful analytics normalization, content cadence, invite tokens, MCP schemas, onboarding configuration, and hostname maps. It does not provide adequate evidence for cross-brand isolation, role boundaries, payment ownership, public-token scoping, export, or deletion. Those protections must be written in the platform before the corresponding feature is migrated.

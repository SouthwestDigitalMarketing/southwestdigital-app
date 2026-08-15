# Bookkeeping Conroe source audit

Source: `LochsideLLC/bookkeepingconroe-web`

Initial audit date: 2026-08-15

## Current system

- Next.js 16 App Router application deployed on Netlify
- Auth.js/NextAuth v5 beta with Google, email magic link, and a local development bypass
- Prisma 6 with Supabase PostgreSQL
- 69 historical migration directories
- known production migration drift documented in the source runbook
- large mixed codebase containing both the public Bookkeeping Conroe website and reusable application capabilities

## Tenant migration hazards

- user brand access is stored in `User.allowedBrands` as a string instead of relational memberships
- brand configuration is keyed by free-form string values
- client portal hostnames and default brands are hard-coded
- `isExternalClient` conflates identity type and authorization
- global user roles conflate platform, staff, and tenant permissions
- many business records do not have a required `brandId`
- existing client-like models mean different things in different modules
- authentication callbacks currently authorize users without tenant context

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


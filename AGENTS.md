# Southwest Digital App engineering rules

This repository contains the multi-brand application operated by Southwest Digital Marketing.

## Non-negotiable architecture rules

- `Brand` is the only tenant level. Do not introduce an organization or client-account layer without an approved architecture decision.
- A user has one global identity and gains access through explicit `BrandMembership` records.
- Every record containing tenant-owned business data must have a required `brandId`, a foreign key to `Brand`, and an appropriate brand-leading index.
- Resolve the entry brand from a database-backed `BrandDomain`; do not add hard-coded production hostname maps.
- Treat the active brand as request/session context. Never authorize access merely because a brand identifier was supplied by the browser.
- Platform roles and brand roles are separate. A brand administrator is not a platform administrator.
- Integration credentials are brand-specific, encrypted at rest, and server-only. Never expose secrets through `NEXT_PUBLIC_*` variables.
- Do not send authenticated portal activity or sensitive client data to advertising platforms by default.
- Never run a destructive production migration without a backup, rehearsal, reconciliation report, and rollback plan.

## Framework guidance

This project uses Next.js 16. Read the relevant local guide in `node_modules/next/dist/docs/` before using framework APIs or conventions that may have changed.


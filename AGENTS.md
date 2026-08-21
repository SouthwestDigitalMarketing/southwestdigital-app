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


<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

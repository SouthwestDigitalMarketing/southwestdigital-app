# SaaS readiness implementation

Branch: `feat/saas-readiness`. Scope authorized September 5, 2026: implement the review recommendations, excluding AI features, including phone/tablet responsiveness across screens, dialogs and flows. No pushes or production deployments are authorized.

## Completion gates

- [x] Public proposal DTOs and authenticated OAuth relays (unit/route regressions; live provider verification still required)
- [ ] Tenant schema, scoped repositories, runtime-role isolation and migration rehearsal
- [ ] Immutable signing and reconciled payments, receipts and PDFs
- [ ] Role permissions, public-link lifecycle, integration/asset boundaries
- [ ] Reliable sends, neutral reviews and truthful lifecycle metrics
- [ ] Durable scoped drafts, Today, timeline and client onboarding
- [ ] Unified navigation, components, accessible dialogs and error/loading states
- [ ] All-route phone/tablet/desktop responsive verification
- [ ] Repeatable firm/team setup, subscription billing/entitlements and exports
- [ ] Growth attribution, customer-success records and non-AI referrals
- [ ] CI, operational runbooks, restore/release and security validation

AI product features and marketing bots are excluded. Live calls, interviews, pilot recruitment and testimonial collection require real participants; document readiness and results without fabricating completion. Pricing, commissions and external provider configuration remain explicit configuration decisions rather than invented commercial commitments.

## Work log

- Created the implementation branch from `abc476e`. The existing roadmap is preserved. Baseline: typecheck and 265 unit tests pass; full lint has nine errors and ten warnings. Browser connection and live database/provider state must be rechecked before runtime verification.
- Security boundary phase: public bookkeeping props now use a nested allowlist and published prices; Zoho relay verifies signed state before forwarding authorization codes; both providers require an active brand and authorized return host. Public proposal checkout is host/brand-scoped and respects expiration/archive/completion, while signed records remain available. Shared settings and YouTube mutations require brand administration; staff retain their personal mailbox. Logo uploads are decoded, bounded and re-encoded as WebP; raw SVG is rejected, including from the same-origin legacy asset proxy. Existing SVG objects in public storage have not been deleted and require a separate inventory/replacement review.
- Settings responsiveness: responsive page spacing, stacked phone logo/color/theme controls, wrapping upload actions, labeled file controls. This is code-level work only, not all-screen visual sign-off.
- Verification: typecheck passed; 302 unit tests passed before four additional Zoho route regression tests (those four also passed). Full lint still has the nine baseline errors/ten warnings; no new lint errors are intentionally accepted. Browser/live-provider verification remains outstanding.
- Dependency audit: seven high-severity affected package entries, from two root advisories: Nodemailer raw-message file/URL access (`GHSA-p6gq-j5cr-w38f`, no fix reported) and deepmerge-ts recursive graph stack exhaustion (`GHSA-ggr8-5vv4-36mx`, Prisma config dependency). Do not use `npm audit fix --force`: it proposes incompatible downgrades. Current auth uses a fixed Nodemailer provider payload, not caller-supplied raw messages; Prisma configuration is developer-controlled. These are mitigations to verify, not a clean security audit or permission to ignore advisories.

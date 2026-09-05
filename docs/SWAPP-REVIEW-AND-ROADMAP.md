# SWapp: product review and completion roadmap

Reviewed September 5, 2026, against local commit `abc476e`.

## Recommendation

Build SWapp into the growth and client-acquisition workspace for independent bookkeeping firms: a place to know the next action, price work confidently, send a polished proposal, collect a signature and payment, and hand a new client into delivery.

The strongest existing product is the offer-to-payment workflow. Make that workflow dependable and easy enough for another bookkeeper to use without the founder explaining every step. Use Bookkeeping Conroe to prove it, use the community to teach it, and expand referrals and automation after customers repeatedly achieve the promised result.

The current application is a substantial internal product under development. It has useful multi-brand foundations and working feature implementations, but the source review found security and correctness issues that should block opening it to independent customer firms. A broad feature count is not yet evidence of SaaS readiness.

This document is a review and proposed implementation plan. It does not authorize deployments, production data changes, outbound messages, or implementation of the recommendations.

## Evidence and limits

- Inventoried 52 page files, 22 API route handlers, and 106 Prisma models. Reviewed architecture documentation, navigation, tenant/authentication helpers, core server actions and data access, public proposal/payment routes, integrations, exports, and the principal UI implementations. This is an app-wide architecture and product review, with deeper inspection of sensitive flows; it is not a line-by-line audit of every file.
- `npm run typecheck`: passed.
- `npm test -- --run`: 40 test files and 265 tests passed.
- `npm run lint`: failed with 9 errors and 10 warnings. Findings span CommonJS scripts, React hook/component rules, server-page purity rules, images, and an accessibility attribute. Triage individual findings; a lint diagnostic is not automatically a demonstrated runtime defect.
- No connected browser was available after supported browser discovery. No screenshots, keyboard walkthrough, mobile rendering, measured page performance, or live end-to-end checkout was verified. UI observations below come from source; usability targets are proposed acceptance criteria.
- Did not query the live database, inspect secret values, send messages, run migrations, create payment transactions, or verify deployed provider configuration. Database policies, grants, backups, webhook registration, and production behavior remain verification work.
- Reviewed Bookkeeping Conroe's public website through available web results. The supplied YouTube channel did not resolve through web retrieval/search sufficiently to audit its videos or audience. The channel/community strategy below uses the owner's stated vision; no audience size, conversion rate, or revenue is assumed.
- `HANDOFF.md` and `README.md` contain stale status information. The typography pass is committed at `abc476e`; the initial worktree was clean except for user-owned `.claude/`. Authentication configuration also conflicts with older handoff advice: `src/auth.ts` explicitly rejects `AUTH_URL` and `NEXTAUTH_URL`.

## The business being built

There are two customer journeys sharing a proof engine:

| Audience | Problem | Destination | Evidence of success |
| --- | --- | --- | --- |
| Business owner needing bookkeeping | Behind, uncertain, or spending too much time managing books | Bookkeeping Conroe consultation and services | Qualified lead, suitable engagement, successful client delivery |
| Bookkeeper building a firm | Inconsistent sales process, unclear pricing, weak follow-up | Skool education, SWapp adoption, implementation help | First proposal, first paid engagement, repeat use, measurable operational improvement |

YouTube demonstrates actual firm-building work. Bookkeeping Conroe produces operating experience and real results. Skool turns that experience into relationships, education, implementation support, and customer feedback. SWapp makes the method repeatable. Consented case studies demonstrate results, and satisfied users can refer other users and suitable bookkeeping clients.

Keep the two audiences distinguishable in calls to action and attribution. A business owner seeking bookkeeping should reach a consultation path; a bookkeeper seeking the operating method should reach a community/implementation path. Bookkeeping Conroe's current public site emphasizes catch-up work, monthly bookkeeping, and consultation, which supports the first journey. [Public website](https://www.bookkeepingconroe.com/).

The defensible asset is the combination of a tested method, useful software, ongoing education, and trusted relationships. AI-assisted development increases delivery capacity; it does not replace product validation or evidence that a customer achieved a result.

### Initial commercial promise

Suggested positioning to validate: **“Turn bookkeeping inquiries into signed, paid clients—with a clear next step every day.”**

Start with independent bookkeepers and small firms that already receive some inquiries and sell recurring bookkeeping or catch-up work. Test the real-estate specialty as an initial segment because it fits the channel identity; do not assume all future users need that specialty.

Sell one core product initially, with clearly separated implementation/coaching options. Price discovery should measure willingness to pay, support time, activation, and retention in a small paid cohort. Avoid announcing a final price before that evidence exists.

## Current product map

| Area | What exists | Completion work |
| --- | --- | --- |
| Identity and brands | Global users, explicit memberships, platform roles, brand selection, branded host resolution, platform administration | Uniform policy enforcement, admin/member capabilities, customer team management, lifecycle tests |
| CRM and contacts | Search/import, tags, client links, pipelines, stage moves and notes | Reconcile parallel data models; unified contact timeline; activity/staleness across pipeline and offers |
| Offers | Bookkeeping assessment and pricing, consulting/coaching offers, drafts, publishing, follow-ups, version snapshots | Protect internal fields, durable drafts, concurrency/version handling, complete list pagination and follow-up coverage |
| Agreements and payment | Agreement templates, e-signature evidence, Stripe Connect, Payment Element, cancellation, receipts/PDF | Shared payment validation, immutable signed commercial terms, reliable webhooks, kind-aware receipts, payment recovery |
| Clients and delivery | Client records and contact associations; many ticket/onboarding/team models in schema | A usable paid-client handoff, ownership, onboarding tasks and delivery integration; distinguish schema from shipped workflows |
| Marketing analytics | Website/GA4 and YouTube reporting, goals, source-tag click helpers | Reliable metric definitions, freshness/errors, conversion attribution, tenant integration setup |
| Reviews | SMS request/reminder and public response page | Correct brand links/senders, neutral review solicitation, truthful click-versus-review metrics, suppression and send reliability |
| Catalog/configuration | Services, discounts, tags, media folders, brand themes, tools, email settings | Stronger role permissions, setup defaults, progressive disclosure, validated URLs/assets |
| SaaS operations | Brand creation, feature records, integration registry, offboarding/export job records | Subscription billing and entitlements, guided onboarding, support access controls, working export worker, operational runbooks |
| Community/referrals/AI | Skool external link; a referral offer page that outlines intended terms | Actual partner enrollment, attribution, referral handoff, commission accounting, automation jobs and controls |

There is no need to complete all 106 models before selling the core workflow. Several represent inherited or future operations such as timecards, invoices, meetings, focus tools, and onboarding. Each needs an explicit decision: part of the first release, internal-only, integrated with another tool, or deferred.

The sidebar links to `/team`, but this repository has no corresponding page or redirect in `next.config.ts`. The `/portal` foundation surfaces also coexist with newer app surfaces. This produces both navigation debt and competing interpretations of the product.

## Launch blockers and concrete findings

Priorities: **P0** means address before expanding real usage of the affected surface; **P1** means required before independent firms rely on the paid product; **P2** means planned quality/scale work. Findings are source-confirmed unless explicitly marked as needing runtime verification.

### P0 — Internal assessment data crosses the public browser boundary

The bookkeeping public proposal passes `snapshot.assessment` directly to the client component as `initialAssessment`. `AssessmentState` includes `assessmentNotes`, exposed in the builder as “Internal Assessment Notes.” Publishing materializes catalog/template data while retaining other assessment properties through object spread.

Consequently, a published assessment containing internal notes is passed into the public page's React payload, even though the visible proposal does not render a notes section. This is a source-confirmed data-boundary defect; this review did not inspect an actual client payload.

Fix with an explicit, allowlisted public proposal DTO, computed on the server. Keep internal assessment, pricing rules, staff notes, and unnecessary owner/contact information out of public props. Split public presentation from the staff builder. Test with sentinel internal values and assert absence from HTML, RSC responses, and public APIs.

Evidence: `src/app/(proposal)/proposal/[token]/page.tsx:228`; `src/app/(app)/offers/builder/ProposalCreationWorkspaceDemo.tsx:317` and `:3197`; `src/lib/quotes/materializeProposalCatalog.ts:244`; `src/lib/agreements/materialize.ts`.

### P0 — Zoho callback relays before authenticating its destination

The platform-origin callback calls `readOptionalReturnOrigin`, which base64-decodes the state without verifying its HMAC or expiry, then redirects to that origin with `code`, `state`, and `error`. Cookie and signed-state validation occur later, after this branch.

This permits an unauthenticated redirect controlled by supplied state and forwarding of any supplied callback parameters. This is not a claim that an OAuth account was compromised. Use the existing signed-state reader before any relay, validate a canonical HTTPS origin against an active verified `BrandDomain`/approved platform origin, then perform membership/cookie binding at completion. Test forged state, expired state, disabled domains, malformed origins, and a valid cross-domain round trip.

Evidence: `src/app/api/email-connections/zoho/callback/route.ts:27`, `:46`, `:97`; `src/lib/emailConnections/zohoOAuth.ts` already provides `readZohoOAuthState`. YouTube uses its signature-verifying reader before its relay; preserve that distinction.

### P0 — Tenant guarantees are inconsistent across the active app

`src/lib/crm/repository.ts` uses `withBrandDataTransaction` and transaction-local PostgreSQL tenant context. The newer `/contacts` implementation uses direct Prisma queries without that context. With the documented forced RLS and a restricted runtime role, such contact queries should see no rows or fail writes. If those queries succeed in deployment, the actual policy/role configuration needs investigation; this review does not establish which condition is present.

The schema also falls short of `AGENTS.md`: for example, `Engagement` and `Quote` have required `brandId` but no declared `Brand` relation; `PipelineItem`, `PipelineStage`, and `QuoteLineItem` lack their own `brandId`. A simple schema scan found 23 models with required `brandId` but no declared direct `Brand` relation. Some historical migrations declare constraints independently, so the scan is evidence of schema inconsistency, not proof that 23 live database foreign keys are missing.

Inventory every business-data table and relationship. Reconcile schema, actual constraints, grants, RLS, and application repositories. Require brand-leading indexes and composite relationships where they prevent cross-brand links. Introduce narrow server-authorized contexts for public links, jobs, and platform operations before extending RLS; blanket policies would break bootstrap/authentication paths.

Acceptance: the actual runtime credential fails closed without context, brand A cannot read/write/link brand B records, context never leaks through pooled connections, and active app workflows still work. Preserve Brand as the only tenant level.

Evidence: `src/lib/tenancy/context.ts`; `src/lib/crm/repository.ts`; `src/app/(app)/contacts/page.tsx:90`; `src/app/(app)/contacts/actions.ts`; `prisma/schema.prisma:1719`, `:1739`, `:1982`, `:2422`, `:2480`; `docs/architecture/database-tenant-isolation.md`.

### P0 — Payment success does not consistently prove the intended obligation was paid

`confirm-payment` marks an engagement paid when its stored PaymentIntent is succeeded, without comparing expected amount, currency, connected destination, engagement metadata, and accepted terms. The `payment-intent` route has another succeeded-intent shortcut before its destination safety plan. The webhook also calls the paid helper directly and permits missing `brandId` metadata.

The helper overwrites payment evidence and timestamps on repeated processing and updates engagement and quote separately. There is no durable webhook-event receipt/deduplication ledger in the inspected handler. A signed Stripe event is necessary but does not replace application reconciliation. Stripe explicitly documents duplicate and delayed deliveries. [Stripe webhook guidance](https://docs.stripe.com/webhooks?lang=node).

Create one server payment-reconciliation path used by all three entry points. Compare against an immutable accepted payment obligation and the destination recorded when the attempt was created; account changes must trigger deliberate reconciliation, rather than silently judging historical payments against a newly connected account. Store attempts and processed event identities, use transactional state transitions, and handle mismatches, duplicates, refunds, disputes, asynchronous confirmation, and retries explicitly.

The handoff says the live webhook is not configured. Treat that as an unverified deployment item requiring dashboard confirmation and test evidence.

Evidence: `src/app/api/proposal/[engagementId]/confirm-payment/route.ts:37`; `src/app/api/proposal/[engagementId]/payment-intent/route.ts`; `src/app/api/stripe/webhook/route.ts`; `src/lib/engagements/fromOffer.ts:111`.

### P1 — Signed terms and mutable proposal state can diverge

The sign route captures agreement text, hash, signer data, and selection in `proposalAcceptance`, which is a useful foundation. It does not pin `signedQuoteRevisionId`, and its check/write sequence is not atomic against concurrent selection/publish/sign requests. Hourly republishing overwrites `services.hourlyCheckout` even when agreement text is retained because a signature exists.

Receipts and signed PDFs parse the current `proposalBuilderState.services` using bookkeeping checkout logic. They do not read an immutable signed quote revision. Thus frozen agreement text can coexist with changed presentation or payment terms; hourly summaries can be incomplete.

Pin the exact accepted revision and selection, amount/currency, destination policy, signer evidence, and agreement hash atomically. Require stale-version rejection. Use those immutable values for payment, receipt, PDF, and delivery handoff. Signed changes need an amendment/new offer path. Lock signed/paid publication changes on the server, not merely with an Edit warning.

Evidence: `src/app/api/proposal/[engagementId]/sign/route.ts`; `src/app/(app)/offers/hourly/actions.ts`; `src/app/(proposal)/proposal/[token]/receipt/page.tsx:52`; `src/app/api/proposal/[engagementId]/signed-document/route.ts`.

### P1 — Public links lack a uniform lifecycle policy

`hasPublicProposalAccess` checks token, engagement, and publication, but not brand status, quote expiry, archive/revocation status, or request-domain association. `resolvePublicBrand` checks an active brand but omits domain purpose and verification status, unlike the stricter login resolver.

Define separate permissions for reading an offer, changing selection, signing, paying, and retrieving a historical receipt. A revoked/expired offer should not remain payable just because its token still matches; a valid historical receipt may need a different retention policy. Use cryptographically random revocable capability tokens, limited public DTOs, appropriate no-store/referrer policies, and no authenticated-advertising pixels. Test brand suspension and disabled domains across every public route.

Evidence: `src/lib/engagements/publicProposalAccess.ts`; `src/lib/brands/resolve.ts`; `src/lib/brands/repository.ts:46`; `prisma/schema.prisma` (`Quote.expiresAt`).

### P1 — Brand configuration privileges are too broad for a SaaS team

The staff helper admits `MEMBER`, `ADMIN`, and `OWNER`. Settings actions and integration connection endpoints largely use that helper. A normal member can therefore reach actions for brand appearance and payment onboarding, not just their own mailbox.

Define and enforce a capability matrix: platform operator; brand owner/admin; staff member; viewer; and, if client access is introduced, explicit resource-scoped client permissions. Payment connections, team roles, exports, and brand-wide settings need deliberate administration permissions. A personal mailbox connection can remain membership-owned. Audit support access with a reason and limited duration; do not introduce another tenant level.

Evidence: `src/lib/brands/staff.ts:13`; `src/app/(app)/settings/actions.ts:116`; `src/app/api/youtube/connect/route.ts`.

### P1 — Browser drafts can survive account/brand changes

The proposal storage helper keys by offer/contact/engagement or a shared base key, without brand or user. Contact details and assessments are persisted. Brand switching and sign-out do not clear these keys. This creates shared-device privacy and incorrect-draft risks, especially for a new unsaved proposal.

Make a server draft with its own stable ID the source of truth. Use debounced autosave, an explicit saved/unsaved/error state, optimistic concurrency, and recovery. If browser recovery storage remains, namespace by brand + user + draft + schema version, expire it, and clear it appropriately. Verify brand switching, sign-out/in, two tabs, network loss, refresh, and recovery from another device.

Evidence: `src/app/(app)/offers/builder/ProposalBuilderStorage.ts`; `ProposalContactInfoState.ts:168`; `ProposalCreationWorkspaceDemo.tsx:1288`; `src/app/(app)/actions.ts`; `src/app/select-brand/actions.ts`.

### P1 — Review requests are not ready for another firm

The sender builds links from `AUTH_URL` with a localhost fallback, while `auth.ts` rejects `AUTH_URL`. In the supported configuration, generated SMS links therefore fall back to localhost. SMS credentials/from-number are global; the public review destination is a global environment value or a hardcoded Google review URL. A new firm cannot safely inherit these defaults.

The UI also asks for a five-star review separately from private feedback, and `recordFiveStar` records a five-star outcome before a Google review exists. Replace this with a neutral request for an honest review, offer all customers the same public review opportunity, and name observed metrics accurately: request sent, link opened, Google link clicked, feedback received. Google disallows selectively soliciting positive reviews and incentivized reviews. [Google review policy](https://support.google.com/contributionpolicy/answer/7400114?hl=en-GB).

Resolve public URLs from verified brand configuration. Use brand-specific messaging identities and review destinations; add sender quotas, consent/suppression checks appropriate to the message, input limits, and send status/retry records. The current creation-before-send flow can leave a record looking sent after an external failure.

Evidence: `src/app/(app)/reviews/actions.ts:32`; `src/lib/quo.ts`; `src/app/r/[token]/page.tsx:46`; `src/app/r/[token]/ReviewPage.tsx`; `src/app/r/[token]/actions.ts:6`.

### P1 — Shared integrations and uploads need explicit boundaries

PayPal uses platform-wide credentials and should be disabled for external-tenant checkout until correct merchant routing and reconciliation exist. GA4 uses a global service-account client; delegated platform access can be intentional, but brand grants, property validation, ownership, and revocation need a documented and audited path. YouTube credential loading does not check integration status and can fall back to per-slug environment variables.

Asset upload accepts client-declared MIME including SVG and stores bytes without inspecting/sanitizing content. Authenticated GET serves the stored MIME through the app origin. Untrusted active SVG on that origin is a security risk requiring testing and remediation. Reject/sanitize or rasterize SVG, validate file signatures, and isolate public assets from private documents and exports. No live exploit was attempted.

Use the existing encrypted integration registry consistently, dedicated encryption keys with a rotation plan, minimal server-returned metadata, connection health, and audited revocation. Separate platform infrastructure credentials from tenant-owned provider connections explicitly.

Evidence: `src/lib/paypal.ts`; `src/lib/analytics/ga4.ts:57`; `src/lib/youtube/credentials.ts`; `src/app/api/brand-assets/route.ts:13`; `src/lib/storage/r2.ts`.

### P1 — Counts and follow-up queues can mislead users

The offer list takes 50 rows and derives “Your move” from that result. There is no page/cursor parameter for older results in this query, so follow-ups outside the selected 50 can disappear from attention. Other lookup lists fetch all contacts/clients. The dashboard excludes `completed` from its offer query even though payment sets that status; paid wins can fall out of the accepted/sent metrics. Sending an email can change a completed quote back to `sent`.

Use one lifecycle policy and explicit event history. Query due work independently of paginated lists; calculate aggregates in the database. Distinguish sent, signed, paid, waived, archived, refunded, and lost. Do not use a changed `updatedAt` as a substitute for the event being measured. A page GET currently records proposal/review opens; link scanners/prefetch can create false engagement signals, so distinguish observed page fetch from qualified client interaction.

Evidence: `src/app/(app)/offers/page.tsx:125`, `:180`; `src/app/(app)/dashboard/page.tsx:193`; `src/app/api/email/send/route.ts`; `src/lib/engagements/fromOffer.ts`; public proposal/review pages.

### P1 — Operations and portability are partly scaffolding

Exports are job records with future worker/storage/download behavior, not delivered exports. The docs explicitly defer the scheduled offboarding runner. The schema and migrations have drift, and no `.github` workflow is present in this checkout. Production CI may exist elsewhere and needs verification. Current public terms also claim ownership of all content, which conflicts with the architecture's brand-controlled data policy.

Rehearse schema reconciliation and backups/restores in a disposable environment; establish a reproducible migration baseline before restoring routine deploy migrations. Complete private exports including offers, signed records and payment references, scheduled transitions, retention and restore/deletion handling. Add CI, security/dependency checks, release rollback, structured error reporting, health checks, and operating ownership. Have final contracts, privacy/data processing terms, and referral terms reviewed for the actual business model and jurisdictions.

Evidence: `docs/architecture/offboarding-and-exports.md`; `docs/architecture/data-ownership.md`; `src/lib/offboarding/repository.ts`; `src/app/terms-of-service/page.tsx`; `HANDOFF.md`.

## Experience and visual direction

“Apple level” should mean clear hierarchy, predictable behavior, excellent typography, immediate feedback, and careful handling of every state. Apple's guidance emphasizes structure, navigation, purposeful content, adaptive layout, accessibility, and undo. The recommendation is to apply those principles to a bookkeeping workflow. [Apple design foundations](https://developer.apple.com/videos/play/wwdc2025/359/), [interface fundamentals](https://developer.apple.com/documentation/technologyoverviews/interface-fundamentals).

### Navigation by work

Proposed primary destinations: **Today, Pipeline, Offers, Clients, Growth**. Keep firm settings in a secondary area and Help/community always reachable. Put services, discounts, agreement templates, tags, and media under a coherent setup/library area. Team belongs in settings until a complete team work surface exists. Keep platform administration separate from tenant work.

Today should show the few actions that matter: contact a new inquiry, send a ready offer, follow up, resolve a payment issue, or start onboarding. Each card shows the person/company, why it needs attention, owner, due time, and one clear action. Let users defer, assign, complete, and view history.

Create one contact/client timeline joining relevant inquiries, notes, offers, signature/payment, onboarding, and review requests. Choose a canonical operational client model; preserve `CustomerAccount` only as a brand-owned business record if retained, never as a new tenancy layer.

### Simplify the offer journey

Keep the underlying assessment richness, but present it progressively: **Client → Scope and price → Review and send**. Existing Scale, Complexity, Adjustments, and Options become sections inside that flow. Validate this grouping with users before removing the current seven-step flow.

Provide a recommended default package and disclose adjustments on demand. Save automatically. Keep “saved draft” distinct from “published version.” At the send step, show recipient, message, client-facing preview, and readiness issues together. Payment/mail setup should be resolved during onboarding, with actionable recovery if disconnected later.

Public proposals should give clients a concise scope, price, payment schedule, start expectations, optional detail, and one obvious next action. Preserve reviewable legal text and accessible controls. Test signing/payment on mobile, including declined cards, delayed confirmation, revisiting, and a failed network request.

### A design system with limited choices

- Preserve the semantic theme-token work already implemented. Add reusable components for page headers, buttons, fields, cards, data tables, dialogs, menus, status badges, notices, empty states, loading, and errors.
- Use calm neutral surfaces, a restrained brand accent, and semantic status colors. Retain clear tenant identity without allowing arbitrary color combinations to undermine readability.
- Extend the current readable typography work consistently: approximately 16px body/input text, 14px secondary labels, and a small heading scale. Test rather than hardcode text density everywhere.
- Standardize spacing on a small scale, card radii, input heights, alignment, table density, and icon treatment. Avoid competing gradient/shadow systems or page-specific overrides.
- Prefer labeled primary actions. Icon-only secondary actions need real accessible names, usable target sizes, and clear focus/hover behavior. Avoid relying on tooltip discovery for essential steps.
- Use a tested accessible dialog/menu primitive with focus containment, Escape, focus restoration, background inertness, and keyboard navigation. Do not independently reimplement these behaviors on each page.
- Show inline validation next to the field; preserve input after failure. Make save/send/payment results explicit. Support undo for reversible actions and give destructive confirmations meaningful context.
- Support 200% zoom, keyboard-only use, reduced motion, high-contrast/focus states, long names, empty tables, and small screens. Use list/card alternatives where wide tables cannot remain usable.

Visual acceptance requires actual browser review at representative mobile, tablet, narrow desktop, and large desktop sizes, in supported themes. Record screenshots for Today, pipeline, offer builder, public proposal, payment, receipt, onboarding, and settings. Validate with at least five target bookkeepers, observing tasks without coaching them through the interface.

## Performance and engineering optimization

The large client modules are a maintainability and bundle-risk signal, not a measured performance result: `ProposalCreationWorkspaceDemo.tsx` is 3,364 lines and `OfferProposalPreview.tsx` is 2,010. The public preview imports shared code from the large builder module. Extract pure pricing/types and server-calculated public data, then split optional editor dialogs/media/charts behind demand-driven loading.

The dashboard awaits YouTube work, then GA4, then database stats. Fetch independent sources concurrently and stream independent panels. Cache analytics snapshots by brand, provider/property, time range, timezone, and filters; show their freshness. External-service failure should produce a useful unavailable/stale state, not a plausible-looking zero. Keep authorization checks current even when data is cached.

Use safe per-request memoization for repeated session/brand resolution. Profile before adding cross-request caching; every tenant cache key and invalidation must preserve isolation. Aggregate counts in PostgreSQL, paginate offers, search contact pickers remotely, and index verified query patterns. Remove seeding/schema-repair writes from normal rendering once setup/migration is reliable.

Move email delivery, analytics refresh, exports, provider event processing, and future automation onto durable jobs with idempotency, retries, bounded concurrency, and a failed-job review queue. Build on the existing deployment/database/storage choices unless measured needs justify a change.

Proposed performance targets, to validate on realistic data and devices: LCP ≤2.5 seconds, INP ≤200ms, CLS ≤0.1 at the 75th percentile; visible acknowledgment of interactions within roughly 100ms; a usable app shell without waiting for every analytics provider. Measure cold/warm requests, slow networks, large tenants, query counts, and job backlog. These are release goals, not current measurements. [Core Web Vitals](https://web.dev/articles/vitals).

For deployment work, strongly recommend installing the missing Vercel CLI with `npm i -g vercel` for environment retrieval, deployment inspection, and logs. Installation is not part of this review. Reconcile stale Netlify instructions only after verifying the active Vercel release setup; do not migrate infrastructure merely for cleanup.

## SaaS readiness

### First-run activation

The first-run path should create the Brand, owner membership, defaults, and verified entry configuration; then guide logo/theme, services/pricing, payment connection, mailbox, a sample contact, and a practice proposal. Offer a safe demo workspace using synthetic records and provider test mode. A $1 live test is still a real transaction and is not a substitute for demo isolation.

Support restarting setup, clear integration errors, invite/resend/revoke, and a meaningful “ready to send” checklist. Initial cohorts can receive assisted provisioning, but support must not require manual database edits. Validate Gmail/Microsoft demand before broad onboarding: current Zoho support alone may exclude much of the intended audience.

### Two separate money flows

| Flow | Who pays whom | Required product records |
| --- | --- | --- |
| Firm service payment | A bookkeeping client pays their bookkeeper through the firm's connected account | Accepted obligation, payment attempt, charge/refund/dispute evidence |
| SWapp subscription | A bookkeeper's Brand pays Southwest for software | Brand subscription, plan/entitlements, invoices, renewal, grace period, cancellation |

Do not conflate these ledgers. `Brand.subscriptionStartedAt`/`EndedAt` and feature records are not a recurring SaaS billing engine. Add explicit subscription/provider state, server-enforced entitlements, seat/usage rules, customer billing management, and dunning/reconciliation. Begin with simple packaging. Keep community membership and software access decoupled enough to support legitimate subscription changes.

Existing recurring bookkeeping prices are commercial terms, not proof that recurring collections are automated. For the first release, either provide an explicit tracked handoff to the firm's existing recurring billing process or implement and verify recurring collection. Never imply that a one-time onboarding payment started a subscription.

### Customer success and support

Attach help to tasks: short walkthroughs, setup checklists, weekly implementation calls, progress reminders, and an easy route to support. Distinguish the firm owner's onboarding from their client's onboarding. Record blockers and support time so the product improves and coaching capacity remains economical.

Customer data export must work before promising portability. Record transparent support access, tenant suspension effects, integration revocation, security incident ownership, backup/restore procedures, and data retention. Require stronger authentication/step-up for privileged operations as part of the security design; a provider migration is not a prerequisite unless current requirements cannot be met.

## Growth, community, referrals, and AI

### Measure the loop without inventing attribution

Use distinct campaign destinations for business owners and bookkeepers. Capture first/last touch on consented leads and explicit partner codes where available. Preserve the source of a community/demo signup across later SWapp activation with an authorized linkage. A Skool link click is not a verified community join; a YouTube view is not an identified prospect. Use manual verified cohort records or supported integrations until reliable events exist.

Record a small event vocabulary: inquiry received, demo requested, setup completed, first offer published, first offer sent, offer signed, payment reconciled, client onboarding started/completed, repeated weekly use, case-study consent, referral converted. Keep brand business events separate from Southwest product analytics. Do not send client identities, proposal contents, or authenticated portal activity to advertising systems by default.

For every demonstration, show a concrete problem, the workflow, the result, and a relevant next step. Record whether an example is synthetic or a permitted real case. Use a dedicated demo brand with payment and sending disabled/test-bound for recordings. Redacting the screen alone does not protect names in notifications, URLs, browser tabs, PDFs, or network data.

Ask for case studies after a documented milestone. Record the baseline, time period, result, limitations, participant permission, and any material relationship. An affiliate or discounted participant's endorsement needs appropriate disclosure; incentives must not depend on a positive testimonial. [FTC endorsement resources](https://www.ftc.gov/business-guidance/advertising-marketing/endorsements-influencers-reviews), [FTC review/testimonial rule FAQ](https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers).

### Referral network in two stages

Separate software referrals from client-service referrals. They can share enrollment and attribution primitives, but they have different permissions, success criteria, and payment rules.

1. **SWapp referrals:** partner enrollment, agreed terms, tracked code/link, qualified paid conversion, refund/chargeback hold, approved commission, payout, reversals, and partner statement. Start with simple direct-referral rewards tied to actual retained sales. Do not pay merely for recruiting other referrers. Choose commission rates only after measuring gross margin and support cost.
2. **Bookkeeping-client referrals:** opt-in introduction, service-fit criteria, capacity, acceptance/decline, consented handoff, ownership/status, and quality feedback. Share the minimum lead details authorized for that introduction. One firm's CRM must never become browsable by the network.

Keep each firm as a Brand. A platform-operated program can be owned by the Southwest operating Brand, with brand-owned program/referral/commission records and an explicit participant projection. Cross-brand visibility must be a narrow, authorized sharing operation; neither a shared contact database nor an organization layer is needed. Commercial/legal/tax terms and the ownership/sharing model need a concrete design before payouts are automated.

### AI coding and marketing operations

For coding agents, require a small acceptance-tested task, a bounded branch/worktree, tenant-contract checks, targeted tests, review of changes, and a human-controlled release. Add repository checks that catch missing tenant fields, unauthorized raw database imports in business modules, public DTO leaks, and secret exposure. Agent throughput is useful only if regressions are caught reliably. The user's explicit no-push policy remains in force.

For product/marketing automation, begin with tasks that assist staff: summarize permitted activity, draft a follow-up, turn approved video transcripts into draft content, suggest a next action, and prepare a case-study outline from consented evidence.

Represent each bot as a service identity with a tenant/campaign scope, allowed tools, spend limits, run history, and accountable owner. Treat retrieved emails, webpages, documents, and community content as untrusted input, never authority to grant tools or change policy. Keep credentials outside model context, redact client data, and test cross-tenant leakage and prompt injection.

Use stages: draft → review → approved scheduled action → evaluated result. Add idempotency, unsubscribe/suppression handling, frequency caps, recipient validation, cost tracking, retry limits, and a kill switch before allowing unattended sends. Expand automatic execution only for narrowly defined, reversible or low-risk actions with measured quality. No fabricated testimonials, undisclosed personas, or automated audience spam.

The repository currently has neither a marketing-agent runtime nor a referral commission system. Design these after the durable jobs, business events, permissions, and attribution foundation is working.

## Delivery plan and release gates

These are dependency-ordered milestones, not a promised calendar. Security/database reconciliation is the largest early uncertainty. Estimate task durations after reproductions and a disposable database rehearsal; do not commit to a launch date based on agent coding speed alone.

| Phase | Deliverable | Exit gate |
| --- | --- | --- |
| 0. Establish the baseline | Reconcile docs with code/deployment; reproduce highest-risk defects; inventory data/routes; create isolated demo/staging setup; fix lint gate | Agreed first-release scope, reproducible checks, reliable staging and recovery path |
| 1. Protect data and money | Public DTO, verified OAuth relay, scoped repositories/schema/RLS, role rules, public-link lifecycle, immutable signing/payment reconciliation, safe assets and integration boundaries | No open P0 issue; actual runtime-role two-brand tests; public-payload tests; payment replay/concurrency tests; reviewed production preflight |
| 2. Complete the daily workflow | Canonical CRM/client model, Today queue, durable drafts, contact timeline, full offer pagination, reliable sends, kind-aware receipt/PDF, paid-client onboarding handoff | Bookkeeping Conroe completes inquiry → offer → sign/pay → onboarding without manual DB fixes or lost follow-ups |
| 3. Make the product coherent and beautiful | Shared components/tokens, simplified navigation, progressive builder, mobile proposal/payment polish, keyboard and error-state behavior, measured performance | Observed user-task success; browser screenshots and accessibility checks; responsive layouts and performance targets validated |
| 4. Operate a paid SaaS pilot | Assisted repeatable Brand setup, team management, subscription/entitlements, verified provider setup, private exports, support/runbooks, contracts | 5–10 independent firms can activate, pay, operate, receive support, and leave/export safely; no special-case tenant code |
| 5. Prove customer outcomes | Weekly implementation calls, activation/retention/support metrics, consented case studies, separate audience attribution | Repeat use and documented outcomes across a cohort; sustainable support and gross margin; reasons for churn understood |
| 6. Expand distribution and automation | Direct software referral program, then consented client referrals; narrowly scoped marketing agents | Reconciled partner statements, reliable conversion/payout records, controlled cross-brand sharing, automation quality/cost/suppression evidence |

Design-system groundwork and interviews can run alongside security work, but external paid rollout waits for the safety and workflow gates. Keep version control changes small and reviewable, preserve existing user work, and never push without explicit instruction.

### First implementation backlog

| Order | Task | Acceptance evidence |
| --- | --- | --- |
| 1 | Remove internal assessment from public DTOs | Internal sentinel absent from HTML/RSC/API; pricing and proposal rendering unchanged |
| 2 | Authenticate and authorize Zoho relay destination | Forged/expired state and disabled origins rejected; valid multi-host flow succeeds |
| 3 | Trace active app queries under restricted database role | All business routes mapped; no-context and cross-brand reads/writes denied; expected workflows pass |
| 4 | Reconcile tenant fields, relations, policies and migration baseline | Backup + disposable rehearsal + reconciliation report + rollback; no production destructive migration |
| 5 | Centralize immutable signature/payment state | Stale tabs rejected; concurrent signing safe; replay does not rewrite evidence; destination/amount/currency mismatch quarantined |
| 6 | Tighten role, public-token, integration and asset boundaries | Member/admin matrix; suspension/revocation checks; malicious upload rejection |
| 7 | Repair review URLs, brand destinations and metrics | Verified brand links and sender; neutral solicitation; external failure reflected truthfully |
| 8 | Fix lifecycle metrics and due-work completeness | More than 50 offers fixture; paid wins remain counted; send never demotes completed state |
| 9 | Make drafts durable and scoped | Account/brand switching, refresh, offline recovery, two tabs and conflicts verified |
| 10 | Build Today and the client timeline/onboarding handoff | New inquiry and paid engagement have an owner, next action and durable history |
| 11 | Apply visual system to one full vertical workflow | Desktop/mobile/keyboard completion from inquiry to receipt; empty/error/loading states reviewed |
| 12 | Deliver repeatable SaaS onboarding, billing and export | Two independent test firms complete setup through cancellation/export with isolated records |

### What to defer

Defer a replacement accounting ledger, broad time tracking/payroll, a bespoke community platform, a full content suite, an open referral marketplace, multi-level rewards, and unrestricted autonomous outreach. Keep consulting/coaching functional because they already support the business, but prioritize the bookkeeping workflow in onboarding and messaging.

Do not rewrite the application wholesale. Retain Brand/BrandMembership, the existing theme tokens, pricing tests, Stripe Connect foundation, and working catalog/proposal behavior. Refactor behind those capabilities with explicit contracts and regression evidence.

## Success measures

Use **firms repeatedly progressing real client work each week** as the leading product-health measure, paired with signed-and-paid outcomes. Exclude demo/test transactions. Track SaaS revenue separately from firms' client payments.

| Question | Measure |
| --- | --- |
| Can a new firm start? | Setup completion, time to first real offer, integration failure rate |
| Does it help sell? | Qualified inquiry → offer → signature → reconciled payment, median time per stage |
| Does it save work? | Time spent preparing an offer, missed follow-ups, manual corrections, support requests |
| Does use continue? | Activated firms returning to complete meaningful work at weeks 2/4/8; cohort retention and churn reasons |
| Can the business afford growth? | SaaS gross margin after infrastructure, provider fees, AI, commissions and support; support minutes per firm |
| Does community help? | Implementation attendance, blockers resolved, activation following help, verified member outcomes |
| Do referrals work? | Qualified referrals, paid/retained conversions, reversals, payout accuracy, partner quality |
| Is the platform dependable? | Error rates, failed/retried jobs, backup restore evidence, denied-access tests, payment reconciliation exceptions |

Initial pilot hypotheses—not forecasts: a guided firm can send its first valid proposal in its first session; most pilot firms can repeat the workflow without founder intervention; no client-visible internal fields, cross-brand access, lost drafts, or mismatched paid records remain. Set numerical conversion and retention goals after recording the baseline and cohort size.

The next authorized implementation should begin with the public data boundary and OAuth relay fixes, followed by tenant isolation and payment integrity. The next product validation should observe bookkeepers completing the offer-to-payment workflow with synthetic data and no coaching, then use their failures to shape the first coherent design pass.

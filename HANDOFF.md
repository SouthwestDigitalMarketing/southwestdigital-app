# Coding-agent handoff

Updated: 2026-09-05 (America/Chicago) — offer-builder Finalize step + builder caption/alignment pass landed (see §12).

## Start here

- Read `AGENTS.md` before changing code. Its tenant, authorization, secret-handling, analytics, migration-safety, and Next.js 16 rules are non-negotiable.
- Current branch: `main`. Deployment is on **Vercel** (not Netlify — that's stale in older docs). Vercel CLI is not installed; use dashboard for env vars until user installs `npm i -g vercel`.
- `.claude/` is untracked user-owned content. Do not modify.
- Never commit `.env.local` or any secret. `AUTH_SECRET`, `ZOHO_MAIL_CLIENT_ID`, `ZOHO_MAIL_CLIENT_SECRET`, `INTEGRATION_ENCRYPTION_KEY`, Stripe/PayPal keys, and Supabase URLs are all secrets.

## Push policy

The user has instructed: **never push without explicit user instruction**. Commit locally at every phase boundary so work is preserved; leave push to the user. If a phase is done and unpushed, say so in "Current commit state" below.

## Current commit state

- `HEAD` == `origin/main` at `eb903d8 Add offer lifecycle tracking and hourly preview safety` (the old §§6–11 lifecycle batch; the "21 unpushed commits" note from 09-04 is resolved — all pushed).
- **Line-ending noise warning (still true):** ~100 tracked files show as modified with identical content (worktree CRLF vs blob LF — `git diff --ignore-all-space` is empty for them). Do NOT commit that noise: stage only the files you changed, and normalize any touched file back to LF (`sed`/python CRLF→LF) so the commit holds only the logical diff.
- §12 (Finalize step) committed and pushed this session; working tree otherwise still carries the CRLF noise above.

## This session's work

### 1) Stripe Connect safety — DONE, pushed (`66e9796`)

Replaced the silent platform-account fallback in the proposal PaymentIntent route with a strict destination-charge policy:

- If the brand has no `ACTIVE` Stripe Connect integration → 409 blocking response. No more accidental charges to Southwest Digital Marketing's platform balance.
- If a prior PaymentIntent has `transfer_data.destination` missing (platform-only from before Connect activation) or pointing at a different connected account → cancel and recreate with the correct destination.
- Extracted the decision into a pure helper `src/lib/stripe/connectPaymentPlan.ts` with 10 unit tests covering block, already-paid, reuse-update, reuse-as-is, create-fresh, cancel-and-create.

Key files: `src/app/api/proposal/[engagementId]/payment-intent/route.ts`, `src/lib/stripe/connectPaymentPlan.ts`, `src/lib/stripe/connectPaymentPlan.test.ts`.

### 2) Zoho email connections — DONE, pushed (`f9f31e3`)

Per-membership OAuth connection so staff can send email from their own Zoho mailbox from inside the app.

- New `EmailConnection` model (per-membership, unique). Encrypted access + refresh tokens using existing `encryptSecret`/`decryptSecret` (AES-256-GCM, keyed off `INTEGRATION_ENCRYPTION_KEY` or fallback `AUTH_SECRET`).
- Region-aware Zoho OAuth: US / EU / IN / AU. HMAC-signed state binds membership + brand + returnOrigin.
- Zoho Mail API integration: token exchange, refresh with revoke-detection, account lookup, send. Uses Zoho's `Zoho-oauthtoken` bearer prefix (not standard `Bearer`).
- Settings page has an Email connections section with four provider cards. Zoho is fully enabled; Gmail / Microsoft / SMTP show as "Coming soon" so users see the roadmap.
- Test-message form on the settings panel proves end-to-end delivery.
- Migration `prisma/migrations/20260904160000_email_connections/migration.sql` — additive, idempotent, already applied to local DB.
- User has completed local Zoho API Console setup and confirmed end-to-end test send works from their real Zoho mailbox.

**Env vars needed:** `ZOHO_MAIL_CLIENT_ID`, `ZOHO_MAIL_CLIENT_SECRET`. Optional prod: `PLATFORM_BASE_URL`, `INTEGRATION_ENCRYPTION_KEY`.

Key files: `src/lib/emailConnections/{providers,zohoOAuth,zohoMail,repository,send}.ts`, `src/app/api/email-connections/**`, `src/app/(app)/settings/EmailConnectionsPanel.tsx`, `docs/email-connections/zoho-setup.md`.

### 3) Zoho wired into real flows — DONE, committed locally (`327efab`), not pushed

- New shared helper `sendFromMembership` in `src/lib/emailConnections/send.ts` with typed `EmailConnectionMissingError` and `EmailConnectionRegionInvalidError`.
- New route `POST /api/email/send` — generic authenticated send taking `{ to, subject, body, bodyHtml?, offerId? }`. Optional `offerId` marks the quote as sent.
- Proposal cover-letter screen (`ProposalCoverLetterDemo.tsx`): primary "Send from your mailbox" button; "Copy email" moved to secondary escape hatch. On 409 not-connected, inline banner links to Settings.
- Agreement cancellation notification (`requestAgreementCancellationAction`): sends via connected Zoho instead of Resend. `AUTH_RESEND_KEY` is no longer required for this flow.
- Docs `docs/email-connections/zoho-setup.md` gained §2b Vercel production setup section.

### 4) Product Type refactor — DONE for the core plan (all 9 phases landed locally)

**Goal:** make product type a first-class dimension so the app can offer Consulting (one-off hourly) and Coaching (session pack) alongside the current Bookkeeping proposal shape. Everything downstream — signing, Stripe Connect + destination charges, receipts, cancellation — is reused. Only the offer builder, proposal preview, and pricing calculation branch by type.

Full plan lives below in **"Product Type refactor plan"** section. Progress markers land here as each phase commits.

**Assumed defaults (user delegated):**
- Product types: `BOOKKEEPING`, `CONSULTING`, `COACHING`. New values added later via `ALTER TYPE ADD VALUE`.
- Coaching payment (v1): **one-time upfront** (session pack). True subscriptions are v2.
- Signing / agreement / payment: reuse existing infrastructure.
- `/offers` list unified with Type column + filter.
- `CatalogService` gets a single `productType` per row.
- Hourly builder v1: one primary service with quantity + optional intake fee (no multi-line).

**Phases (see plan below for detail):**
- Phase 1: Schema + backfill + Prisma types — **DONE, committed `6f26d15`.**
- Phase 2: Catalog `productKind` + seed hourly services — **DONE, committed `b0a8ddb`.**
- Phase 3: Product-type chooser + `/offers` list Type column — **DONE, committed `301e8be`.**
- Phase 6 (moved earlier): `resolveAmountDueNow` per-kind + tests — **DONE, committed `5e0438d`.**
- Phase 4: Hourly builder — **DONE, committed `58014d3`.**
- Phase 5: Hourly proposal preview + public dispatch — **DONE, committed `8a6011e`.** Note: `HourlyPublicView` shows a Sign & Pay UI that stops at "PaymentIntent ready" — the full Stripe Payment Element render for hourly is a follow-up (Phase 5.5). PaymentIntent creation, Connect-safety, tests, sign, agreement text are all wired.
- Phase 8: `AgreementTemplate.defaultForProductKind` + preselect — **DONE, committed `c397749`.**
- Phase 7: Email templates per kind — **DONE, committed `296f6bd`.**
- Phase 9: Docs + verification — **DONE.** `docs/architecture/product-kinds.md` explains the model and how to add a new kind. Typecheck ✅ · 39 test files / 238 tests ✅ · focused eslint ✅.

**Follow-ups not blocking day-to-day use:**
- ~~`HourlyPublicView` Stripe Payment Element~~ — **done in this session's work, see section 9.**
- Receipt page (`/proposal/[token]/receipt`) still assumes bookkeeping snapshot shape; hourly receipts will show odd blanks until the receipt is made kind-aware. Also reads the *current* published snapshot, not the exact revision the client signed against — see the version-tracking design section for the `signedQuoteRevisionId` fix.
- Confirm-payment route doesn't validate destination account before marking paid (open item from Stripe Connect safety phase).
- PayPal path (`/api/proposal/[engagementId]/paypal/*`) also needs the same hourly-checkout dispatch if you plan to enable PayPal on hourly offers.

Each phase → its own commit. Fresh agents can `git log` since `f9f31e3` to see what's landed.

### 5) Manage Offers workflow — DONE, local commits not pushed

- Draft rows no longer show a redundant “Resume” action. The pencil Edit action opens the appropriate builder.
- Non-draft rows use a primary eye-icon action to open the published, client-facing proposal. If no published token exists, the fallback is “Details”.
- The Edit action shows an amber warning badge and confirmation modal when the proposal has been viewed, signed, or paid. Viewed-only warnings recommend republishing/resending; signed/paid warnings recommend duplicating the offer so the existing signed/payment terms are not silently replaced.
- Staff proposal previews append `staffPreview=1` and are server-authorized by session, active user status, and brand membership/platform role. Authorized previews render the published proposal without stamping `firstViewedAt`.
- Duplicate markers now live in the Offer ID column and retain their source tooltip and clear control. `$1 test proposal` markers remain in the contact column.
- The separate exact “Last sent” date and “Days ago” columns were consolidated into one sortable “Last sent” column with relative values such as “Today”, “1 day ago”, “8 days ago”, and “Not sent”.
- Verification for the latest changes: TypeScript ✅ · focused ESLint ✅ · 39 test files / 238 tests ✅ · `git diff --check` ✅.

**Naming clarification:** I switched from `productType` (planned) to `productKind` (built) because `Quote.kind` (String) already existed with two values (`bookkeeping`, `referral-network`). Extending that field's semantics is cleaner than introducing a redundant enum. `OFFER_KINDS` in `src/lib/quotes/kinds.ts` is the canonical list; `isOfferKindKey` validates. Hourly builder is at `/offers/hourly` and reads `?kind=consulting|coaching` from the URL.

### 6) Work-item / next-action lifecycle system — DONE, uncommitted

The Manage Offers table now surfaces "what's my next move" at a glance, powered by a derived lifecycle stage + a stored activity clock. This is the concrete MVP of the "unified work items / next-action system" future-design section below.

**Schema:** two nullable columns added to `Quote` — no enum, no coupling to CRM `PipelineItem` (the CRM path is a future pass).

- `lastActivityAt` — bumped by every event that resets the "how long has this been sitting" clock: publish, send, resend, client view, sign, pay, follow-up nudge sent.
- `lastFollowUpAt` — bumped only when staff sends a follow-up nudge. Feeds a 3-day cooldown so the row leaves the stale bucket immediately after a nudge and doesn't re-enter until the cooldown expires.

Migration `prisma/migrations/20260904200000_add_quote_lifecycle_tracking/migration.sql` is additive, idempotent, and includes a backfill: `lastActivityAt = GREATEST(publishedAt, firstSentAt, lastSentAt, sentAt, firstViewedAt, updatedAt, createdAt)` for existing rows. Applied to local DB.

**Helpers** (`src/lib/quotes/lifecycle.ts`, 27 tests):

- `LifecycleStage` = `DRAFT | READY | SENT | VIEWED | SIGNED | PAID | CLOSED`.
- `deriveLifecycleStage(input)` — pure function; reads `status`, `publishedAt`, `firstSentAt`, `firstViewedAt`, and the engagement's `signedAt` + `onboardingFeeStatus` (treats `WAIVED` as `PAID`). Only inspects `status` for the archived-terminal case; everything else derives from event timestamps.
- `deriveWaitingOn(stage)` → `STAFF | CLIENT | NONE`. `DRAFT` and `READY` = STAFF; `SENT / VIEWED / SIGNED` = CLIENT; `PAID / CLOSED` = NONE.
- `STALE_THRESHOLD_DAYS`: `READY: 0` (staff should send immediately), `SENT: 4`, `VIEWED: 5`, `SIGNED: 7`, `DRAFT / PAID / CLOSED: Infinity`. `FOLLOW_UP_COOLDOWN_DAYS: 3`.
- `isStale(input)` — false for null `lastActivityAt` (fresh row); respects the threshold and cooldown.
- `nextStaffAction(input)` returns one of `EDIT_DRAFT | SEND_READY | NUDGE_UNVIEWED | NUDGE_UNSIGNED | NUDGE_UNPAID | NONE`.
- `bumpQuoteActivity(quoteId)` / `markQuoteFollowUpSent(quoteId)` — DB writes for the bumpers; never throw (activity tracking must never break its host flow).

**Hooks wired** (every event that should reset the stale clock):

- Publish (`offers/who/actions.ts`, `offers/hourly/actions.ts`) — bumps `lastActivityAt = publishedAt`.
- Mark-sent (`offers/actions.ts markQuoteSentAction`) — bumps `lastActivityAt`.
- Resend (`offers/actions.ts resendQuoteAction`) — bumps both `lastActivityAt` and `lastFollowUpAt` (it's a nudge by definition).
- Send via connected mailbox (`api/email/send/route.ts`) — bumps `lastActivityAt`, and additionally `lastFollowUpAt` when `firstSentAt` is already set (distinguishes first send vs. nudge).
- First client view (`(proposal)/proposal/[token]/page.tsx`) — bumps `lastActivityAt` + also self-heals (see section 10).
- Sign (`api/proposal/[engagementId]/sign/route.ts`) — bumps `lastActivityAt` on the quote update.
- Paid (`lib/engagements/fromOffer.ts markEngagementDepositPaid`) — bumps `lastActivityAt` when status flips to `completed`.
- Waived (`api/proposal/[engagementId]/payment-intent/route.ts` zero-amount branch) — bumps `lastActivityAt` so the row doesn't stay in a stale-nudge state after WAIVED is set.

**UI:**

- **Manage Offers → row-level state-driven blue button.** View/Details is now neutral (secondary); Edit is blue for `EDIT_DRAFT`; Send is blue for `SEND_READY` and the three `NUDGE_*` actions with a state-appropriate primary label. Last-sent cell tints amber when the row is stale.
- **"Your move" section** on `/offers` (was "Needs your follow-up") — appears above Manage Offers when any rows have a non-NONE action. Shows up to 6 cards sorted by staleness with client, stage hint, days-since-publish/quiet, and a "Review" link that anchors to the row.
- **Follow-up compose flow** — nudge buttons route to `/offers/cover?offer=X&followUp=unviewed|unsigned|unpaid` and swap the initial-send template for a state-appropriate short follow-up template (`followUpCopy` in `ProposalCoverLetterDemo.tsx`). Send goes through the same `/api/email/send` (Zoho) which bumps `lastFollowUpAt`.

**Key files added or changed:** `src/lib/quotes/lifecycle.{ts,test.ts}`, `src/app/(app)/offers/page.tsx`, `src/app/(app)/offers/{OfferEditButton,SendOfferEmailButton}.tsx`, `src/app/(app)/offers/builder/ProposalCoverLetterDemo.tsx`, `src/app/(app)/offers/{actions,who/actions,hourly/actions}.ts`, `src/app/api/email/send/route.ts`, `src/app/api/proposal/[engagementId]/{sign,payment-intent}/route.ts`, `src/lib/engagements/fromOffer.ts`, `src/app/(proposal)/proposal/[token]/page.tsx`.

### 7) Service-type modal — icons + inverted-theme cards

The "Create offer" modal's service-type cards now use a new `.theme-dark` CSS utility (added to `globals.css`) that inverts against the ambient theme: brand-dark background in light mode, brand-light background in dark mode. Each card's header inlines a lucide icon (`BookOpenText` bookkeeping, `Clock` consulting, `GraduationCap` coaching, `Share2` referral-network). Icon map lives locally in `OffersListControls.tsx` so the `OFFER_KINDS` data module stays icon-free.

### 8) Offer-ID column icons — circular, no clear button

Both the test-proposal and duplicate-of markers now render as `h-6 w-6` amber circles inside the Offer ID column (previously the test-proposal marker floated absolute-positioned inside the contact column). Icons: `FlaskConical` for test proposals, `Copy` for duplicates. Both are icon-only with hover tooltips. The X clear-duplicate-marker button was removed from the pill; `ClearDuplicateMarkerButton.tsx` + its server action remain in place as dead code in case a different clear-affordance is wanted later. Test-proposal + duplicate markers can now co-exist on the same row (dropped the `!isTestProposal` guard).

### 9) Hourly proposal end-to-end + staff-preview banner + new-tab links

Three fixes that came out of user testing the hourly-coaching flow.

- **Hourly Stripe Payment Element wired.** `HourlyPublicView` now imports the same `DepositPaymentForm` component the bookkeeping flow uses, mounts `<Elements>` on the returned PaymentIntent's client secret, and calls `/api/proposal/[engagementId]/confirm-payment` on success. Hourly proposals are fully payable end-to-end. Phase 5.5 gap closed.
- **Staff-preview banner + gating on both flows.** When `?staffPreview=1` is set and authorized by session, both `HourlyPublicView` and `OfferProposalPreview` show a persistent amber dashed banner ("Staff preview — the client has NOT signed or paid"), and the sign + pay actions are disabled so staff can't submit on the client's behalf. `canSignAgreement` includes `!isStaffPreview`; `submitSignatureAndContinue` short-circuits. Both components accept an `isStaffPreview` prop; page.tsx passes `isAuthorizedStaffPreview` through.
- **All in-app "view proposal" links open in a new tab and land in preview mode.** Updated: the Manage Offers eye button, the hourly builder post-publish "Preview as staff" link, the hourly builder's "current public link", the bookkeeping builder header's proposal-preview button (via `ProposalAppDemoHeader.saveThenOpenProposal`), and the cover-letter compose page's external-link icon. The raw URL that gets pasted into the email body remains unchanged (that's what actually gets sent to the client).

### 10) READY lifecycle stage + Mark-as-sent fallback + self-heal on first view

A refinement of section 6 driven by the observation that publishing doesn't equal sending — publishing generates the URL; sending is a staff action.

**New model:** publishing → `READY` (has `publishedAt`, no `firstSentAt`, no `firstViewedAt`). The Send button on Manage Offers becomes primary/blue immediately in `READY` (threshold = 0). "Sent" only happens when:

1. **Send via connected Zoho mailbox** (primary path, already wired via `/api/email/send` which stamps `firstSentAt`).
2. **Manual "I sent it another way — mark as sent" button** on the compose page (`ProposalCoverLetterDemo.tsx`) — calls the existing `markQuoteSentAction`. This is the escape hatch when email isn't connected or staff sent via a different channel (personal email, text, WhatsApp). Handles Next.js `NEXT_REDIRECT` propagation so the action's built-in redirect to `/offers/{id}?sent=1` works.
3. **Self-heal on first real client view** (`(proposal)/proposal/[token]/page.tsx`) — if a client somehow opens the URL without staff having sent it (leaked link, out-of-band share), the first view stamps `firstSentAt`, `sentAt`, `lastSentAt`, and flips `Quote.status` to `"sent"`. This keeps DB filters (`Draft` / `Sent` / `Completed`) consistent with the derived lifecycle. Never fires for staff previews (`?staffPreview=1`).

**Downstream effect:** the Edit warning fires only when the derived stage is `VIEWED / SIGNED / PAID` (never on `DRAFT` or `READY`). Fixes the "why is there an edit warning on a draft" case that surfaces when a proposal's `firstViewedAt` got stamped by a staff visit before we added the preview guards.

### 11) Follow-ups & known gaps at end of this batch

- **User's `...zd5n` row** (hit before preview guards existed) will now be derived as `VIEWED` because `firstViewedAt` is set. If that's stale test data and not a real client view, `UPDATE quotes SET "firstViewedAt" = NULL, "firstSentAt" = NULL WHERE id = '<id>'` in Prisma Studio.
- **Test-proposal Lump/MRR display.** User explicitly opted to leave the Lump column showing the real list price on `$1` test rows (the `FlaskConical` icon + tooltip carries the "$1 will be charged" meaning). If this ever confuses in practice, section-based options are captured in conversation history.
- **CRM `PipelineItem` still uncoupled.** The work-item primitive lives on `Quote` only; the "proposals also appear as cards in the CRM pipeline board" pass is deferred. See the future-design section below for the linkage.

### 12) Offer-builder Finalize step + builder caption/alignment pass — DONE, committed and pushed this session

User asked for a real Finalize step at the end of the bookkeeping builder (was: Preview's Next button became View Proposal).

- **Stepper:** `ProposalAppDemoStep` + `STEP_ITEMS` gain `finalize` → `/offers/finalize` after Preview (`ProposalAppDemoStepper.tsx`). Preview's inline View Proposal button untouched per user.
- **New route** `src/app/(app)/offers/finalize/page.tsx` (staff-gated, Suspense) + client `ProposalFinalizeDemo.tsx`: single main card with **1. Save / 2. Publish / 3. Send** sections (white/tinted/white, `h2` headers matching other steps). Each section has its own button running the same actions as the header icons (`saveOfferDraftAction` / `publishOfferChangesAction` + contact sync + `proposal-public-path` localStorage).
- **Sequential gating:** Publish locked until Save; Send renders as a muted non-link pill until Publish (tooltip reasons on both). Done steps render emerald-tint (`border-emerald-300 bg-emerald-50 text-emerald-800`); active step keeps `ui-action-primary`. Returning state restores on load (`?offer=` ⇒ saved; `getOfferPublicPathAction` ⇒ published).
- **Caption/alignment pass** (Contact, Scale, Complexity, Adjustments, Finalize): removed floating captions ("Contact information" label + its CSS, "Assessment" label on scale/complexity/adjustments) and hid the sidebar's "Pricing calculator" caption behind a new optional `hideLabel` prop on `PricingSnapshotSidebar`. With `hideLabel` the card drops its caption offset (card tops align) and renders an in-card `Pricing` section header (`border-b px-5 py-6`, same `h2` style). Included step intentionally still captioned.
- Commit holds only the logical diff (4 tracked files: 18 insertions / 7 deletions, plus 2 new files) — touched files normalized back to LF per the warning above.

Key files: `builder/{ProposalAppDemoStepper,ProposalFinalizeDemo,ProposalContactInfoDemo,ProposalCreationWorkspaceDemo,PricingSnapshotSidebar}.tsx`, `offers/finalize/page.tsx`.

### Suggested commit split for this batch

If you want to slice the uncommitted work into reviewable chunks before pushing:

1. Schema + lifecycle helpers + tests: `prisma/migrations/20260904200000_add_quote_lifecycle_tracking/`, `src/lib/quotes/lifecycle.{ts,test.ts}`, `prisma/schema.prisma`.
2. Activity-bump wiring across all event hooks: the actions + api/route file edits.
3. State-driven blue button + "Your move" section + follow-up compose swap: `src/app/(app)/offers/page.tsx`, the two button components, `ProposalCoverLetterDemo.tsx` template swap.
4. Service-type modal icons + `.theme-dark`: `src/app/globals.css`, `src/app/(app)/offers/OffersListControls.tsx`.
5. Offer-ID column circular icons + move test marker: `src/app/(app)/offers/page.tsx`.
6. Hourly Stripe Payment Element + staff-preview banner + new-tab links: `HourlyPublicView.tsx`, `OfferProposalPreview.tsx`, `(proposal)/proposal/[token]/page.tsx`, `HourlyOfferBuilder.tsx`, `ProposalAppDemoHeader.tsx`, `ProposalCoverLetterDemo.tsx` external-link.
7. READY stage refinement + mark-as-sent fallback + self-heal on first view: lifecycle stage additions, `(proposal)/proposal/[token]/page.tsx` self-heal, `ProposalCoverLetterDemo.tsx` mark-as-sent button.
8. HANDOFF refresh (this file).

Or squash into one commit if you'd rather not manage the split — the batch is coherent as a single "work-item lifecycle + hourly + preview safety" landing.

## Product Type refactor plan

### Data model

```prisma
enum ProductType {
  BOOKKEEPING
  CONSULTING
  COACHING
}

model Quote {
  ...existing fields...
  productType ProductType @default(BOOKKEEPING)
  @@index([brandId, productType, status])
}

model Engagement {
  ...existing fields...
  productType ProductType @default(BOOKKEEPING)
}

model CatalogService {
  ...existing fields...
  productType ProductType @default(BOOKKEEPING)
  @@index([brandId, productType, offerSection])
}

model AgreementTemplate {
  ...existing fields...
  defaultForProductType ProductType?  // nullable — a template may be default for none, one, or many types
}
```

Migration is additive + idempotent: `CREATE TYPE IF NOT EXISTS`, `ALTER TABLE ADD COLUMN IF NOT EXISTS` with defaults, `UPDATE ... WHERE productType IS NULL` backfills, then `SET NOT NULL`. Follow the pattern in `prisma/migrations/20260904160000_email_connections/migration.sql`.

Apply directly with `npx dotenv-cli -e .env.local -- npx prisma db execute --file <path> --schema prisma/schema.prisma` (never `prisma migrate deploy` — see migration drift note below).

### Payment adapter

Extend `resolveAmountDueNow` in `src/lib/engagements/proposalCheckout.ts` to branch on `productType`:

- `BOOKKEEPING` — existing cleanup + onboarding + first-month calc.
- `CONSULTING` / `COACHING` — full total upfront (single charge). No cleanup, no waiver handling for first month.

`chargeKind` metadata gains `consulting` and `coaching` values. **Payment routes need zero changes** — they call `resolveAmountDueNow` and the Connect-safety helper from Phase 1.

### Hourly builder shape

Simpler than bookkeeping — one primary service, optional intake:

1. Client (reuses Contacts picker).
2. Service — pick from catalog filtered to this type. Quantity + rate (rate defaults from catalog, editable).
3. Optional intake fee (waivable, one-time add-on).
4. Agreement template (per-type default preselected).
5. Publish → `Quote` with `productType`.

No cleanup, no Grow/Improve/Maintain, no monthly tier UI. Reuses `QuoteRevision` snapshotting.

### Public proposal dispatch

`src/app/(proposal)/proposal/[token]/page.tsx` reads the engagement's `productType` and renders either the existing `OfferProposalPreview` (bookkeeping) or a new `HourlyOfferPreview` component. Sign & Pay, receipt, cancellation flow are all shared.

### Test coverage

- Unit tests for `resolveAmountDueNow` per type.
- Unit tests for catalog filtering by product type.
- Unit tests for agreement default resolution per type.
- Keep the Stripe Connect payment plan tests passing.

### Explicit cut lines (v2 or later)

- Stripe Subscriptions (true recurring billing).
- Session scheduling / calendar integration.
- Time tracking against consulting hours.
- Cross-type catalog services (single service usable across types).
- Auto-populated email templates for coaching-for-bookkeepers audience (separate copy tuning, not a new type).

## Database and migration state — read before running Prisma commands

Unchanged from prior session. Supabase PostgreSQL. Migration history is divergent:

- The DB contains consolidated migration `20260817205118_init` that is not in this repo.
- Several repo migrations describe schema already in that consolidated state.
- `prisma migrate status` reports `last common migration: null`.
- **Do not run `prisma migrate deploy` or `prisma migrate dev`.** Apply reviewed idempotent SQL directly with `npx dotenv-cli -e .env.local -- npx prisma db execute --file <path> --schema prisma/schema.prisma`.

Recent additive migrations applied this way (not necessarily recorded in `_prisma_migrations`):
- `20260904160000_email_connections` — applied 2026-09-04.
- Product Type migration (Phase 1) — applied as it lands.

### Windows EPERM on `prisma generate`

Dev server holds `query_engine-windows.dll.node`. Stop `npm run dev`, run `npx prisma generate`, then start again. The `dev` script itself runs `prisma generate` on start, so restarting the dev server is often the fastest path.

## Future design: unified "work items" / next-action system

**Status:** **MVP scope shipped for offers** (see section 6 + 10 above — lifecycle stages, staleness thresholds, blue-button treatment, "Your move" list, follow-up compose templates, self-heal on view, mark-as-sent fallback). What remains future work: the CRM `PipelineItem` coupling, a cross-surface "On your plate today" view, auto-fire nudges, and per-brand thresholds. Sections below are the original design sketch; keep it for the CRM extension.

### The insight

Every actionable row across the app (offer, pipeline card, agreement, ticket) is really a *work item* with three attributes:

1. **Next action** — what needs to happen (Send, Resend, Advance stage, Nudge payment, etc.)
2. **Who owes it** — `waitingOn: STAFF | CLIENT`
3. **Staleness** — how long it's been sitting since the last touch

Blue/primary treatment is *earned*: shown only when `waitingOn = STAFF` **and** staleness ≥ a threshold. Neutral otherwise. That way scanning any list tells you at a glance what's actually on your plate today.

### Concrete surface: Manage Offers table

Currently the blue treatment lives on the View/Details button for every non-draft row, regardless of state. It should follow the state × Last-sent age:

| Row state | Fresh (under threshold) | Stale (over threshold) |
|---|---|---|
| Draft | Edit is blue (always your move) | same |
| Sent, not viewed | Neutral (client hasn't had time) | **Resend** goes blue; Last-sent cell tints |
| Viewed, not signed | Neutral | **Resend / follow-up** goes blue |
| Signed, not paid | Neutral | **Nudge payment** goes blue |
| Paid / completed | Nothing blue | nothing blue |

Thresholds TBD (user has not set them). Suggested starting points: 5 days no-view → nudge; 5 days viewed-no-sign → nudge; 7 days signed-no-pay → nudge.

### What actually needs to *trigger* when a client doesn't view/sign/pay

This is the conversion-critical part. Two flavors, either or both:

- **Auto-nudge to client** — templated follow-up email fires from the connected Zoho mailbox after N days of no-view / no-sign / no-pay. User must be able to preview + approve, or opt into full auto.
- **Staff task creation** — a work item appears in staff's "On your plate today" list saying "Follow up with Acme Corp — proposal sent 8 days ago, not viewed." Clicking it lands on the offer row (or a compose-follow-up screen).

Escalation ladder per stage matters: e.g., day 5 gentle nudge, day 10 second nudge with a different angle, day 15 archive-or-close prompt. The exact cadence should be per-brand configurable (v2) but ship with sane defaults.

### CRM connection

The CRM (`Pipeline` / `PipelineStage` / `PipelineItem`) today only tracks *where* a lead sits, not *when it was last touched* or *what needs to happen next*. To make the work-item model real, the CRM needs:

1. `PipelineItem.lastActivityAt` — bumped by move / note / call log / offer send / proposal view / sign / pay.
2. `PipelineItem.waitingOn` — `STAFF | CLIENT` enum.
3. `PipelineStage.expectedDwellDays` — per-stage staleness threshold (natural extension of `valueMultiplier`).
4. Lightweight `LeadActivity` table (or typed lead notes) so "last touched" is derived, not manually maintained.

### How CRM and Manage Offers talk to each other

The link already exists via `Contact`: `Quote → Contact` on one side, `PipelineItem → MeetingLead → LeadContact → Contact` on the other. Same person, both surfaces.

Shared signal in practice:

- **Send offer email** → bump `lastActivityAt` on any pipeline card whose lead is linked to that contact. CRM card stops looking stale, matching what the offers row now shows.
- **Client views the proposal** → bump the CRM card too (client did something).
- **Client signs** → CRM card auto-advances to a "Signed / awaiting payment" stage (leverage existing but unused `ContactTagAutomation`).
- **"On your plate today"** view unions rows from both sources — an unviewed 8-day-old offer and an untouched 12-day-old pipeline card both appear in the same list, same blue-treatment rule.

Framing: Manage Offers is a filtered slice of the CRM's work-item stream, scoped to `type = OFFER`. It's not really its own thing.

### Cut lines / open questions for next session

- Are thresholds per-brand configurable from day one, or global constants first?
- Auto-fire nudges vs. staff-approves-each — probably staff-approves in v1 to avoid embarrassment.
- Where does "On your plate today" live in navigation? (Homepage? New `/today` route?)
- Does the offer-send bump the CRM card even if the offer isn't attached to any pipeline item, or only if there's a linked card?

### Suggested build order when we come back (CRM extension)

Steps 1–3 and 6 (offers-side) have shipped in section 6 + 10 above. What remains:

1. ~~Add `lastActivityAt` + `waitingOn` to `PipelineItem`~~ → **still open.** Add `PipelineItem.lastActivityAt` + `waitingOn` + `PipelineStage.expectedDwellDays`.
2. ~~Add a `bumpActivity(contactId)` helper~~ → **still open for CRM.** Offer-side bumpers write to `Quote`; extend to also bump linked `PipelineItem` rows for the same contact.
3. ~~Retrofit Manage Offers~~ → **done** (section 6).
4. Retrofit pipeline board cards with the same visual language.
5. Add "On your plate today" view (union query across offers + pipeline items where staff-owned + stale).
6. ~~Add nudge templates + staff approval gate~~ → **done as manual staff-approves-each** (section 6). Auto-send is the v2 extension.

## Future design: proposal version tracking

**Status:** design questions only — nothing built. Captured 2026-09-04 while wiring the hourly payment element. Come back to this before the app supports enough real-client proposals that version drift matters.

### What already exists in the schema

- `QuoteRevision` — versioned snapshots per Quote (`version` int, `snapshotJson`, `publishedAt`, `supersededAt`). Every publish creates a new row and marks prior revisions superseded.
- The public `/proposal/[token]` page reads the latest revision (or the publishedSnapshotJson if no revisions).
- The Manage Offers "Edit" button already surfaces an amber warning when editing a viewed/signed/paid proposal, recommending duplicate-instead-of-edit for signed/paid deals.

### What's missing / undecided

1. **Staff visibility of version history.** No UI shows the version log for a Quote — you can't currently see "v1 published Aug 12, v2 published Aug 15, v3 published today" or diff two versions. Should live on the offer detail page, probably as a collapsible timeline.
2. **Client visibility of version changes.** If we republish while the client has the tab open (or has a bookmark), they get a different offer than what they last read. Do we warn them? Show a "This proposal was updated on X" banner? Force re-scroll of the agreement?
3. **Republish trigger.** Right now editing → publishing silently swaps the URL's contents. Should a republish auto-fire a "we updated your proposal" nudge to the client (with the same trigger machinery from the follow-up system)?
4. **Bumping the version.** Currently `QuoteRevision.version` increments on publish. Do minor edits (typo fix) also bump? Or only material changes (price, scope)? A "publish minor" vs "publish material" distinction might belong on the publish button.
5. **Signed-version pinning.** When a client signs, we should snapshot the exact revision they signed against. Currently the engagement holds the agreement text and the acceptance payload, but not a `signedQuoteRevisionId` pointer. If someone later republishes the offer, we should not silently overwrite what was legally agreed.
6. **Receipt page version.** The receipt currently reads the current published snapshot, not the signed one. Same fix as #5 — receipts must show the terms as signed, not the terms as currently published.

### Suggested build order when we come back

1. Add `signedQuoteRevisionId` on Engagement. Pin it in the sign route.
2. Update `/proposal/[token]/receipt` to load the signed revision, not the current one.
3. Staff-only version history timeline on `/offers/[id]`.
4. Client-facing "updated" banner when they revisit after a republish (compare their last-viewed version to current).
5. Auto-nudge on republish, opt-in per publish action.
6. Diff view for two revisions (nice-to-have for staff).

The [[unified-work-items-next-action-system]] follow-up mechanism can reuse these signals: a republish is another type of activity, and the client's re-view of a republished proposal is another activity bump.

## Deferred / not done this session

- **Stripe Connect edge cases still open:**
  - `confirm-payment` route does not validate that the succeeded PaymentIntent's destination matches the brand's active connected account before marking paid. Low risk now that intent-creation is safe, but worth revisiting.
  - PayPal path routes to the platform PayPal account, not the brand.
  - `/api/stripe/webhook` still lacks a configured endpoint/secret in the Stripe dashboard.
- **Gmail / Microsoft OAuth**: schema/UI slots reserved; providers show as "Coming soon". Enable when there's demand.
- **Test-send fields validation**: `/api/email/send` validates recipient email format but does not rate-limit; abuse risk is small (staff-only) but worth noting.

## Environment variables reference

Required for full functionality:

| Var | Purpose | Where |
|---|---|---|
| `DATABASE_URL` | Runtime Prisma queries (Supabase pgbouncer :6543) | `.env.local` and prod |
| `DIRECT_DATABASE_URL` | Schema operations (Supabase :5432) | `.env.local` and prod |
| `AUTH_SECRET` | JWT signing + fallback encryption key | `.env.local` and prod |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth login | prod |
| `AUTH_EMAIL_SERVER` / `AUTH_EMAIL_FROM` | Magic link email (nodemailer) | prod |
| `AUTH_RESEND_KEY` | Was used by cancellation notice; now unused after Zoho wiring. Still used by login magic link Resend path? Verify. | prod (verify) |
| `AUTH_URL` | App base URL for auth callbacks | prod |
| `STRIPE_SECRET_KEY` | Stripe API | `.env.local` and prod |
| `PLATFORM_BASE_URL` | Locks OAuth callback origins (Zoho, YouTube) | prod recommended |
| `INTEGRATION_ENCRYPTION_KEY` | Dedicated encryption key for stored OAuth tokens. Falls back to `AUTH_SECRET`. Rotating invalidates all stored tokens. | prod recommended |
| `ZOHO_MAIL_CLIENT_ID` | Zoho OAuth app | `.env.local` and prod |
| `ZOHO_MAIL_CLIENT_SECRET` | Zoho OAuth app | `.env.local` and prod |
| `YOUTUBE_OAUTH_CLIENT_ID` / `YOUTUBE_OAUTH_CLIENT_SECRET` | YouTube brand connection | prod optional |

Zoho on Vercel: register a **separate** OAuth app for prod (not shared with local). See `docs/email-connections/zoho-setup.md` §2b.

## Suggested first commands for the next agent

```powershell
git status --short                        # will show a big uncommitted working tree — sections 6–11
git log --oneline origin/main..HEAD       # 21 committed-not-pushed commits
npm run typecheck                         # should be clean
npm test -- --run                         # 40 files / 265 tests, all green
```

Then read this file top-to-bottom, note that **sections 6–11 in "This session's work" are uncommitted** and the user's push policy is "never push without explicit user instruction." Suggested commit split is at the end of section 11.

If the user asks you to move CRM PipelineItem into the work-item model, read section 6 first, then the "Future design: unified work items / next-action system" CRM extension list — the offer-side helpers (`src/lib/quotes/lifecycle.ts`) are the pattern to follow.

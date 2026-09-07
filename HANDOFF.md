# Coding-agent handoff

Updated: 2026-09-07 (America/Chicago) — offer-builder step URLs renamed and the Services step redesign started on a feature branch (see §29). §28's batch is now committed.

## Start here

- Read `AGENTS.md` before changing code. Its tenant, authorization, secret-handling, analytics, migration-safety, and Next.js 16 rules are non-negotiable.
- Whenever this handoff is read, also read `.local/COMPUTERS.md` for the local computer inventory. That file is intentionally ignored by Git and must remain private.
- Current branch: **`feature/services-step-redesign`** (branched from `main` at `776316a`). Nothing is pushed. Deployment is on **Vercel** (not Netlify — that's stale in older docs). Vercel CLI is not installed; use dashboard for env vars until user installs `npm i -g vercel`.
- `.claude/` is untracked user-owned content. Do not modify.
- Never commit `.env.local` or any secret. `AUTH_SECRET`, `ZOHO_MAIL_CLIENT_ID`, `ZOHO_MAIL_CLIENT_SECRET`, `INTEGRATION_ENCRYPTION_KEY`, Stripe/PayPal keys, and Supabase URLs are all secrets.

## Push policy

The user has instructed: **never push without explicit user instruction**. Commit locally at every phase boundary so work is preserved; leave push to the user. If a phase is done and unpushed, say so in "Current commit state" below.

## Current commit state

- On `main`: `776316a Link offer services to catalog` (unchanged; nothing has been pushed).
- Working branch `feature/services-step-redesign`, four commits, none pushed:
  - `f270e02` — checkpoint: step-URL renames plus the previously uncommitted §28 batch, captured so the redesign has a rollback point.
  - `066533a` — Services step scoped to the curated package lineup (990 lines deleted).
  - `fef462c` — fixes for findings from a review of the above.
  - `6e4f226` — golden fixtures pinning what a client sees.
- **§28's batch is no longer uncommitted.** It was swept into `f270e02` together with the URL renames. The "Suggested commit split for the prior batch" below is therefore historical — it was not followed.
- The bookkeeping-copy migration remains committed but intentionally not applied to any database.
- **Line-ending noise warning (still true):** ~100 tracked files show as modified with identical content (worktree CRLF vs blob LF — `git diff --ignore-all-space` is empty for them). Do NOT commit that noise: stage only the files you changed, and normalize any touched file back to LF (`sed`/python CRLF→LF) so the commit holds only the logical diff.
- The line-ending warning above is historical guidance; it was not present after the latest commit. Re-check `git status` before editing and avoid staging unrelated normalization noise.

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

### 13) Offer-builder card and Manage Offers UX pass — DONE, committed and pushed as `69d6fc0`

Builder and offer-list UX work landed as a single commit.

- **Adjustments test proposal control:** `isTestProposal` is part of the assessment builder state and is carried through save/publish actions into the offer snapshot and engagement. The small `Mark as a $1 test proposal` checkbox is now its own final section on the Adjustments step.
- **Assessment card pattern:** Scale, Complexity, and Adjustments use the Contact-step pattern: one rounded main card, alternating section surfaces, summary values, and section-level Edit dialogs. The pricing sidebar remains a separate card.
- **Alternating surfaces:** `AssessmentCardSection.tsx` and `globals.css` use explicit alternating surfaces because the theme CSS otherwise overrides Tailwind background utilities.
- **Manage Offers responsive layout:** narrow desktop widths keep Edit and Send visible, move secondary actions into a More popover, truncate contact labels, reduce cell padding, hide Type / Last sent / pricing columns as needed, and avoid horizontal scrolling through a fixed table layout and container queries. Hidden values remain available in More.
- **Draft edit emphasis:** reviewed the lifecycle logic that makes the Edit pencil blue for the `DRAFT` stage (`nextStaffAction(...)=EDIT_DRAFT`).

Validation: `npm run typecheck` ✅ · focused ESLint ✅ · `git diff --check` ✅. Browser visual verification was unavailable because no browser connection was available.

Key files: `src/app/(app)/offers/builder/AssessmentCardSection.tsx`, `src/app/(app)/offers/builder/ProposalCreationWorkspaceDemo.tsx`, `src/app/(app)/offers/page.tsx`, `src/app/(app)/offers/OfferStatusButtons.tsx`, `src/app/(app)/offers/OfferContactCell.tsx`, `src/app/(app)/offers/DuplicateOfferButton.tsx`, `src/app/(app)/offers/OfferEditButton.tsx`, `src/app/(app)/offers/offers-table.module.css`, `src/app/globals.css`, and the offer persistence files under `offers/builder`, `offers/new`, and `offers/who`.

### 14) Typography floor pass across the first four builder steps — DONE, committed and pushed

Raises the readable-content floor to the browser base (16px Arial = `text-base`) across Contact, Scale, Complexity, and Adjustments. Preserves a clear hierarchy by lifting section headings one step above the new body floor.

**Scope:** the first four steps only (`/offers/new`, `/offers/scale`, `/offers/pricing`, `/offers/calculator`) plus the shared header/sidebar chrome those pages render. Later steps (Options, Preview, Finalize) are untouched and remain the smaller pre-pass sizing.

**Type scale after the pass:**

| Role | Before | After |
|---|---|---|
| Card / modal section heading (`h2`) | `text-lg` (18px) | `text-xl` (20px) |
| Uppercase field label (summary keys + form labels) | `text-[11px] tracking-[0.14em]` | `text-sm tracking-[0.08em]` (uppercase/semibold/slate-500 preserved — see note below) |
| Summary value, form input, notes textarea, helper copy | `text-sm` / `text-xs` | `text-base` |
| Pill toggles, checkbox / radio labels | `text-sm` | `text-base` |
| Pricing breakdown rows, x/% input suffixes | `text-sm` | `text-base` |
| Buttons in the flow (Edit, Add Owner, Add Year, header Back/Next, modal Cancel/Save, exit dialog buttons) | `text-sm font-semibold` | `text-base font-semibold` |
| Tooltip content | `text-xs` | `text-base` |
| Sidebar cleanup headline + amount | `text-lg` | `text-xl` |
| Sidebar "ONE-TIME" cap label | `text-base font-medium` | `text-sm font-semibold` (matches the label pattern) |
| Contact-page input height (needed to keep the input visually balanced at the larger text) | `h-10 rounded-xl` | `h-12 rounded-xl` |

**Note on field-label size** (§14 second iteration): first pass lifted labels to `text-base` (16px) but the uppercase + semibold + tracking treatment read too heavy next to the 16px body copy. Follow-up dropped labels to `text-sm` (14px) with the same uppercase / semibold / tracking-[0.08em] / slate-500 — the "readable-content floor is base" invariant applies to actual content (values, inputs, helper copy, buttons), not to structural micro-labels. If a future pass wants a different label size, all label uses run through two constants: `FIELD_LABEL_CLASS` in `ProposalContactInfoDemo.tsx` and `ProposalCreationWorkspaceDemo.tsx`, plus two inline copies of the same class string (summary label in `AssessmentCardSection.tsx`, "ONE-TIME" label in `PricingSnapshotSidebar.tsx`).

**Intentionally kept smaller** — pure nav chrome, not content:
- Stepper pill labels (`ProposalAppDemoStepper.tsx`) stay at `text-xs`.
- Header toolbar buttons (Save / Publish / Send / Eye / Exit) remain icon-only with `text-[0px]` labels for screen-reader access.

**iOS bonus:** bumping inputs to 16px stops iOS Safari from zooming when the input is focused. Both `INPUT_CLASS_NAME` constants (Contact + workspace) now use `text-base`.

Validation: `npm run typecheck` ✅ · focused ESLint on the five touched files ✅. Browser visual verification unavailable in this session — spot-check the four steps at desktop + narrow desktop widths, especially the pricing sidebar column and the Adjustments card where the newly larger helper copy takes more vertical space.

Key files: `src/app/(app)/offers/builder/AssessmentCardSection.tsx`, `src/app/(app)/offers/builder/PricingSnapshotSidebar.tsx`, `src/app/(app)/offers/builder/ProposalAppDemoHeader.tsx`, `src/app/(app)/offers/builder/ProposalContactInfoDemo.tsx`, `src/app/(app)/offers/builder/ProposalCreationWorkspaceDemo.tsx`.

### 15) Proposal Cover + Agreements manager UX pass — DONE, committed and pushed (`8d53f32`)

This is the latest shipped batch. It includes the responsive builder refinements and the agreements-manager workflow requested by the user.

**Offer builder / Proposal Cover**

- Proposal Cover now follows the same read-only summary + section-level Pencil/Edit modal pattern as Contact, Scale, Complexity, and Adjustments.
- Cover Content uses a two-column modal for Headline and Body text. Cover Media separates media, video button, and continue-button controls into its own section/modal. Theme and Agreement have their own summary sections and editors.
- Removed the redundant “Proposal Cover” page heading and “Customize the first screen” description.
- Agreement copy now refers to selecting an agreement managed in Agreement Manager, with a link to `/agreements`; internal template identifiers remain unchanged for compatibility.
- Builder page frames now use the full available width with stable page-centered navigation, reduced nav-to-card spacing, consistent horizontal padding when the sidebar is expanded or collapsed, and narrower pricing sidebars (`280px` / `300px` at large breakpoints).
- Summary grids use four columns where the content fits, with three/two-column fallbacks to prevent clipping. Manage Offers type cells no longer wrap.

**Agreements**

- `/agreements` now focuses on issued agreements. Its action row contains `New agreement` and `Manage Agreement Templates`, followed by a full-width legal-review reminder.
- Added `/agreements/templates` as a dedicated template manager route. The old page heading/intro was removed; the New template action and legal reminder remain visible in the compact page header.
- Template rows now have icon actions for edit, duplicate, archive/restore, and delete. Delete requires browser confirmation; active templates are archived before deletion, while archived templates can be permanently deleted. Default templates cannot be archived/deleted.
- Added a Current/Archived toggle. New and duplicated templates are treated as drafts until saved; Cancel/X exits without saving and cleans up the unsaved draft.
- Issued agreements table now shows a short designator (`....last4`) instead of the full agreement ID, removes the redundant Agreement column, and removes secondary client/signer lines.
- Added `.agreements-readable` typography floor so table, modal, and control text does not fall below the app base font size.

Validation for this batch: `npm run typecheck` ✅ · `npm run lint` ✅ (7 existing `@next/next/no-img-element` warnings) · `git diff --check` ✅ · browser visual verification unavailable in this environment.

Key files: `src/app/(app)/agreements/AgreementTemplatesManager.tsx`, `src/app/(app)/agreements/IssuedAgreementsTable.tsx`, `src/app/(app)/agreements/actions.ts`, `src/app/(app)/agreements/page.tsx`, `src/app/(app)/agreements/templates/page.tsx`, `src/app/(app)/offers/builder/ProposalIntroDemo.tsx`, `src/app/(app)/offers/builder/AssessmentCardSection.tsx`, `src/app/(app)/offers/builder/PricingSnapshotSidebar.tsx`, `src/app/(app)/offers/offers-table.module.css`, and `src/app/globals.css`.

### 16) Test-proposal pricing display fixes — DONE, committed and pushed (`6455afd`, `d13f6f9`)

Two hotfixes for the `$1 test proposal` mode where the displayed pricing didn't match what `resolveAmountDueNow` actually charges.

- **Pricing sidebar** (`ProposalCreationWorkspaceDemo.tsx`) — the test override only forced monthly to `$1` and left the cleanup-card at the real onboarding+cleanup total (e.g. `$500`). Now zeros the recurring (`monthly: 0`) and collapses one-time totals to `$1` across every package. The cleanup card also renders unconditionally in test mode as a single `$1.00` line (no `$0 × N months` breakdown that would look nonsensical).
- **Proposal preview cards** (`OfferProposalPreview.tsx`) — the preview had its own separate test override that only set `monthly: 1` and never touched `getOnboardingFee`. Now `getOnboardingFee` returns `1` when `assessment.isTestProposal`, and the monthly override sets `0`. Card header + row breakdown + pricing summary all agree on `$1 one-time / $0 recurring`.

`resolveAmountDueNow` was already correct — this batch only fixed display-side inconsistency.

### 17) Options templates for the offer builder — DONE, committed and pushed (`c8444d8`)

Reusable, brand-owned snapshots of the Options step so staff don't rebuild the same option config every proposal. Mirrors the `/agreements/templates` pattern.

**Data model** — new `ProposalOptionsTemplate` (per-brand, JSON snapshot, `defaultForProductKind` flag; unique index `(brandId, defaultForProductKind)`). Migration `20260905120000_add_proposal_options_templates` is additive+idempotent; applied via `prisma db execute`.

**Snapshot library** (`src/lib/quotes/optionsTemplates.ts` + tests) — `buildOptionsTemplateSnapshot`, `parseOptionsTemplateSnapshot` (rejects wrong version or product kind), `reconcileOptionsTemplateSnapshot(snapshot, catalogOfferKeys)` (drops items whose `offerKey` is no longer in the catalog and returns the skipped ids so the toolbar can surface a "N items skipped" toast). 8 unit tests.

**Seed helper** (`src/lib/quotes/optionsTemplatesSeed.ts`) — `ensureDefaultOptionsTemplate(brandId)` idempotently seeds three curated starter templates on first hit for any brand. Hand-picks catalog items by `offerKey` so a proposal shows ~5 items instead of the ~40 raw catalog rows. Templates:

1. **Basic bookkeeping services** (default) — 2 optional (Advanced Receipts, Tax Preparer Coordination) + 3 bonuses (Bookkeeping Document Organization all packages, First Quarterly Review Improve+Grow, DoubleHQ Client Portal all packages).
2. **Real-estate bookkeeping** — same base plus Property Reporting, RE Chart of Accounts, Per-Property Class Tracking, and Stessa Migration (Grow only).
3. **Bookkeeping with all add-ons** — every optional pre-checked.

Ensure runs from three call sites: `/offers/options-templates` page load, `listOptionsTemplatesAction` (fired by the Options-step toolbar on mount), and `getDefaultOptionsTemplateSnapshotAction` (used by auto-apply).

**Server actions** (`src/app/(app)/offers/options-templates/actions.ts`) — list, get snapshot (reconciled), get default snapshot, create-from-catalog (seeds a new row from current catalog defaults), save-from-slice, update name/description, overwrite snapshot, duplicate, set/unset default, archive, restore, delete. Delete requires archived + non-default.

**Manager page** (`/offers/options-templates`) — `New template` primary button + Current/Archived `ui-toggle-switch` toggle below the header (matches the `/agreements/templates` pattern). Row actions: edit (rename/describe only — see below), duplicate, set/unset default, archive/restore, delete. No explanatory copy — kept minimal per user preference.

**Options-step toolbar** (`OptionsTemplatesToolbar.tsx`) — inline in the same button row as `Add optional service` / `Add included service` via the toolbar's outer `display: contents` wrapper and a `middleSlot` prop that receives those Add buttons from `ProposalAddOnsDemo`. Layout: `[Load template ▾] [Add optional] [Add included] [Save as template] [Manage templates ↗]`. Save modal has a mode toggle: **Update existing template** (dropdown of active templates, overwrites in place) or **Save as new template** (name/description/make-default). Auto-apply of the brand default fires once per offer scope, keyed off `engagementId`/`offer` query param in localStorage; guarded by `hasCustomizedOptions` so it never overwrites existing user work.

**Author-flow model** (intentional) — templates are authored by editing an offer's Options step and using **Save current as template → Update existing template**, not by editing snapshot contents on the manager page. The manager only lets you rename/describe/organize. Users tried to author on the manager page and it wasn't discoverable — added the New button + the Update-existing mode to close that loop without building a full snapshot editor.

**One-off backfill script** (`scripts/seedOptionsTemplates.cjs`) — plain node CJS (doesn't trip `server-only`) that seeds every active brand. Ran during this session; safe to rerun. Skips already-existing rows by name.

**Bookkeeping-only for now.** Product kind is `"bookkeeping"` throughout. When Consulting/Coaching hourly builders grow an equivalent Options step, extend the snapshot type and the seed with `productKind` variants.

Key files: `prisma/migrations/20260905120000_add_proposal_options_templates/`, `prisma/schema.prisma`, `src/lib/quotes/optionsTemplates.{ts,test.ts}`, `src/lib/quotes/optionsTemplatesSeed.ts`, `src/app/(app)/offers/options-templates/{page.tsx,OptionsTemplatesManager.tsx,actions.ts}`, `src/app/(app)/offers/builder/OptionsTemplatesToolbar.tsx`, `src/app/(app)/offers/builder/ProposalAddOnsDemo.tsx`, `scripts/seedOptionsTemplates.cjs`.

### 18) Per-package selection for optional add-ons — DONE, pushed (`b8273c1`)

Previously only "included" bonuses had Grow/Improve/Maintain checkboxes in the Options-step table. Optional add-ons showed a "—" — the client saw them on every package card indiscriminately. Now every row has the three checkboxes regardless of `Offer As` mode.

**Storage** — reuses the existing `bonusPackageSelections: Record<string, PackageId[]>` field on `AssessmentState` because keys are just item ids. No schema change. Downstream code that only looked at bonuses now applies to options too. Backward-compat: `undefined` selection defaults to all packages (so pre-existing offers show every option on every package card, as before).

**Editor** (`ProposalAddOnsDemo.tsx`) — new `selectedOptionPackages(option)` / `toggleOptionPackage(option, packageId)` mirror the bonus helpers. The per-package `<td>` render now branches on `row.kind === "optional"` too. `setKind` no longer clears selections when switching between optional/included — the array is preserved. `deleteRow` cleans up the selection entry uniformly.

**Client-facing preview** (`OfferProposalPreview.tsx`) — every package card only shows optional add-ons assigned to it, and its recurring total only sums those:
- New `additionalOptionRowsFor(packageId)` filters by the option's `bonusPackageSelections`, defaulting to all-packages when missing.
- Fixed five call sites: card render (`packageAdditionalOptionRows`), per-package recurring total, `selectedAdditionalMonthlyTotal`, submission payload (`selectedAdditionalOptionIds`), and `selectedAdditionalOptionNames` in the checkout summary.

**Template seed** — `OptionalConfig` gained an optional `packages` field (defaults to all three). Existing seeded rows (which don't carry per-option selections yet) still work because of the all-packages fallback. Both `optionsTemplatesSeed.ts` and `scripts/seedOptionsTemplates.cjs` were updated so future re-seeds populate the field.

Validation: `npm run typecheck` ✅ · `npm test -- --run` 53 files / 357 tests ✅ · focused lint ✅. Browser visual verification unavailable in this session — sanity-check the Options step for a full row of checkboxes and confirm a package card's total drops when you uncheck an option's package.

Key files: `src/app/(app)/offers/builder/ProposalAddOnsDemo.tsx`, `src/app/(app)/offers/builder/OfferProposalPreview.tsx`, `src/lib/quotes/optionsTemplatesSeed.ts`, `scripts/seedOptionsTemplates.cjs`.

### 19) Client-ready options-template review set — DONE, pushed (`b8273c1`); seeded in live DB

Added four non-default, additive templates so the user can compare real proposal cards without replacing the customized default:

1. **Client-ready review — Essential bookkeeping** — low-friction package ladder; paid receipt add-on stays hidden unless staff recommends it.
2. **Client-ready review — Visibility & control** — Project Profitability Tracking and Budget & Monthly Variance Review are visible only in Improve/Grow; Grow adds KPI and cash-flow outcomes.
3. **Client-ready review — Real estate portfolio** — property reporting, ongoing property-level tracking, portfolio KPIs, and conditional Stessa migration with two focused add-ons.
4. **Client-ready review — Compliance & coordination** — Sales Tax and Receipt Capture add-ons plus Tax-Ready Handoff & CPA Coordination in Improve/Grow; Registered Agent is intentionally excluded.

Template snapshots override lead-facing names/descriptions and cadence where needed while preserving stable catalog `offerKey` identities and existing catalog prices. Core services are explicitly included in each snapshot so the package ladder being reviewed is deterministic. Existing templates and defaults are left untouched.

Staff/client terminology now matches the shared cipher without changing data values: the Options table says **Add-on**, **Show lead**, and **Price / month**; proposal cards say **Optional add-ons** and **Included with this package**.

The Options-step **Load template** menu now sizes itself to its longest item instead of using a fixed `w-72`; it retains a viewport-width cap and wraps only on small screens so full template names remain readable.

The idempotent backfill script was updated and run against the configured Supabase DB. The four templates were created for Bookkeeping Conroe, Southwest Digital Marketing, Contigo Accounting, and Melbourne CFO. TREB was skipped because it currently has no bookkeeping options/core catalog rows. A durable review rubric lives at `docs/offers/client-ready-options-templates.md` for later Sol/Astra passes.

Validation: typecheck ✅ · 53 test files / 357 tests ✅ · focused ESLint ✅ (one existing `no-img-element` warning) · `git diff --check` ✅.

### 20) Full-screen proposal-builder preview — DONE, pushed

The Preview section at the bottom of the bookkeeping proposal builder now has a **Full screen** button. It uses the browser Fullscreen API on the preview boundary, keeping the editor out of view while the rendered proposal fills the screen. Full-screen mode has no persistent toolbar; only a compact floating exit icon remains in the top-right corner. The browser's Escape behavior is also supported through `fullscreenchange` state synchronization.

Key file: `src/app/(app)/offers/builder/ProposalIntroDemo.tsx`.

Validation: typecheck ✅ · 53 test files / 357 tests ✅ · focused ESLint ✅ · `git diff --check` ✅. Visual browser verification remains for the user.

### 21) Side-effect-free proposal previews — DONE, pushed

Both preview surfaces are now simulations, not live proposal sessions:

- The embedded bookkeeping preview and authorized `?staffPreview=1` view discard any engagement id before client interaction code can use it. Package selection, signing, payment, and navigation remain local React state.
- The public proposal server route no longer creates an Engagement for an authorized staff preview, does not pass an existing engagement id into either public proposal client, and does not redirect a staff preview to a signed receipt.
- Bookkeeping and hourly staff previews now allow a simulated signature and simulated successful payment so staff can walk the whole lead journey without calling selection, signature, PaymentIntent, confirmation, or cancellation endpoints.
- Preview confirmation copy explicitly says nothing was signed, charged, or recorded. Existing real Agreement Manager, payment, proposal, and CRM records remain unchanged.

Key files: `src/app/(proposal)/proposal/[token]/page.tsx`, `src/app/(app)/offers/builder/OfferProposalPreview.tsx`, `src/app/(proposal)/proposal/[token]/HourlyPublicView.tsx`, `src/lib/quotes/previewSafety.{ts,test.ts}`.

Validation: typecheck ✅ · 54 test files / 362 tests ✅ · focused ESLint ✅ (one existing `no-img-element` warning) · `git diff --check` ✅.

### 22) Centered pricing-page agreement toggle — DONE, pushed

The Month-to-month / Annual control on the proposal's pricing step now uses three equal layout columns. The switch occupies the fixed center column, so it is geometrically centered on the proposal page even though the labels on either side have different widths.

Key file: `src/app/(app)/offers/builder/OfferProposalPreview.tsx`.

### 23) Annual-savings badge uses bonus colors — DONE, pushed

The `Annual · Save N%` control on the proposal pricing step now uses the same emerald background and text treatment as `Included with this package` and the other bonus cues. This gives Modern Dark the requested green savings treatment and keeps the savings signal semantically consistent across themes.

Key file: `src/app/(app)/offers/builder/OfferProposalPreview.tsx`.

### 24) Every pricing card has an included-service section — DONE, pushed

Every pricing card now renders an Included with this package section with at least one truthful item. Maintain shows its direct included services; the higher-tier inheritance and incremental-item behavior is described in §25. Custom configurations fall back to a real recurring upgrade, package-specific support promise, or core bookkeeping service rather than invented placeholder value.

The Sol/Astra review rubric in `docs/offers/client-ready-options-templates.md` now includes this as an explicit evaluation criterion.

Key files: `src/app/(app)/offers/builder/OfferProposalPreview.tsx`, `docs/offers/client-ready-options-templates.md`.

Validation: typecheck ✅ · 54 test files / 362 tests ✅ · focused ESLint ✅ (one existing `no-img-element` warning) · `git diff --check` ✅.

### 25) Higher-tier inclusion inheritance copy — DONE, pushed

Improve and Grow now always state `Everything included with [lower tier], plus:` in both Recurring services and Included with this package. Maintain lists its direct inclusions. Higher-tier green sections list only their incremental included bonuses; when a custom configuration has no new one-time bonus, the card highlights a real incremental recurring upgrade, then its tier-specific support promise as fallback. This preserves both requirements: every card has a concrete green inclusion and the package ladder remains explicit.

Key file: `src/app/(app)/offers/builder/OfferProposalPreview.tsx`.

### 26) Narrow bookkeeping service copy — DONE, pushed; migration not applied

Approved lead-facing core copy:

- **Monthly QuickBooks Bookkeeping** — “Recurring categorization and reconciliation for the QuickBooks accounts included in your plan, using the information and access available to us.”
- The separate legacy audit-oriented item is now **Bookkeeping Document Organization** — “We organize the documents you provide as part of the bookkeeping process.”

Removed the implied guarantees around audit readiness, completing a monthly close, delivering reports, resolving every missing item, and connecting every supporting document. Template parsing normalizes only the known legacy wording, preserving unrelated staff-customized copy. Migration `20260905210000_refine_bookkeeping_service_copy` updates CatalogService and the seven app-seeded options templates, but deliberately does not alter published Quote or QuoteRevision snapshots.

Key files: `src/lib/quotes/optionsTemplates.{ts,test.ts}`, `src/lib/quotes/optionsTemplatesSeed.ts`, `scripts/seedOptionsTemplates.cjs`, `src/app/(app)/offers/builder/ProposalCreationWorkspaceDemo.tsx`, `src/app/(app)/offers/builder/ProposalBonusesDemo.tsx`, `prisma/migrations/20260905210000_refine_bookkeeping_service_copy/migration.sql`.

### 27) Offer identity above builder navigation — DONE, pushed

Every offer-builder step now shows `...[last four of Offer ID] for [primary contact name]` above the header icon controls. The full offer code is loaded through a brand-authorized server action; the primary-contact name comes from the scoped builder state and updates live through a same-tab builder-state event. New/unsaved flows show `New offer`, and missing contact data is explicit rather than guessed.

Key files: `src/app/(app)/offers/builder/ProposalAppDemoHeader.tsx`, `src/app/(app)/offers/builder/ProposalBuilderStorage.ts`, `src/app/(app)/offers/builder/ProposalContactInfoState.ts`, `src/app/(app)/offers/who/actions.ts`.

### 28) Offer-builder navigation + dedicated editable preview — DONE, uncommitted

This section supersedes the current-behavior descriptions in §20, §21, §27, and the older §9 statement that builder previews open in a new tab. Those sections remain useful history, but the current builder behavior is:

**Stepper and header**

- The bookkeeping stepper is now: **Contact → Scale → Complexity → Services → Adjustments → Style → Publish & Send**.
- The former **Options** step is named **Services** and appears before **Adjustments**.
- The former **Preview** step is named **Style**. Its embedded preview was removed; it now contains only the proposal styling/configuration editors (cover content, cover media, theme, and agreement).
- The former **Finalize** step is named **Publish & Send**. Publishing and email/send actions remain on that dedicated step.
- Removed the Back and Next/View Proposal buttons that previously flanked the stepper. The step pills remain clickable.
- Removed the Publish and Email/Send icons from the header row. The remaining icons are ordered **Preview, Save, Exit**.
- The last-four offer reference now uses `*` rather than an ellipsis: `*A1B2 for [primary contact]`. The Manage Offers table and duplicate-source copy use the same asterisk convention.

**Dedicated preview behavior**

- The header eye icon is labelled/tooled as **Preview proposal** and is now the sole entry point to the bookkeeping builder preview.
- Clicking it requests browser fullscreen and client-navigates to `/offers/intro?...&preview=fullscreen`; it does not open a new tab or load the published public proposal path.
- `ProposalIntroDemo` renders `OfferProposalPreview` only while `preview=fullscreen` is present, in a fixed full-viewport surface. A compact icon exits the preview; Escape is synchronized through `fullscreenchange`. If the browser rejects the Fullscreen API request, the fixed full-viewport fallback still works.
- The preview remains an embedded simulation. Package selection, signature, payment, and proposal navigation do not update proposal tracking, Agreement Manager, CRM, or payment records.
- The Publish & Send page's help text now accurately says the eye opens the full-screen proposal preview.

**Contextual editing from preview**

- A circular pencil button lives in the preview's top-right controls. It is white/slate when inactive and navy/white when active, with `aria-pressed` and state-specific accessible labels/tooltips.
- Active edit mode shows small circular pencil controls on editable proposal elements: client details, cover content, cover media, proposal theme, annual discount, package names/services, package pricing, agreement, and payment pricing.
- Clicking a contextual pencil exits fullscreen, preserves the current `offer` query, and routes to the relevant builder page. Cover/theme/agreement targets use section anchors on Style; service/package configuration routes to Services; price/discount targets route to Adjustments; client details route to Contact.
- `AssessmentCardSection` now accepts an optional `sectionId` so contextual preview edits can land on the relevant Style card.

**Exit confirmation**

- Clicking the header Exit icon always opens a save confirmation, even when the builder appears unchanged.
- The dialog contains only the heading **Save before exiting?** and three single-line, base-font actions: **Continue editing**, **Exit without saving**, and **Save & exit**.
- The dialog width hugs the no-wrap action row instead of leaving a large empty left area.

**Files currently modified for this batch**

- `src/app/(app)/offers/builder/AssessmentCardSection.tsx`
- `src/app/(app)/offers/builder/OfferProposalPreview.tsx`
- `src/app/(app)/offers/builder/ProposalAddOnsDemo.tsx`
- `src/app/(app)/offers/builder/ProposalAppDemoHeader.tsx`
- `src/app/(app)/offers/builder/ProposalAppDemoStepper.tsx`
- `src/app/(app)/offers/builder/ProposalBonusesDemo.tsx`
- `src/app/(app)/offers/builder/ProposalContactInfoDemo.tsx`
- `src/app/(app)/offers/builder/ProposalCoverLetterDemo.tsx`
- `src/app/(app)/offers/builder/ProposalCreationWorkspaceDemo.tsx`
- `src/app/(app)/offers/builder/ProposalFinalizeDemo.tsx`
- `src/app/(app)/offers/builder/ProposalIntroDemo.tsx`
- `src/app/(app)/offers/page.tsx`
- `handoff.md`

Validation for this uncommitted batch: TypeScript ✅ · focused ESLint ✅ · 57 test files / 370 tests ✅ · `git diff --check` ✅. The in-app browser had no connected browser instance, so final visual click-through remains for the user/next agent.

### Suggested commit split for the prior batch

If you want to slice the uncommitted work into reviewable chunks before pushing:

1. Schema + lifecycle helpers + tests: `prisma/migrations/20260904200000_add_quote_lifecycle_tracking/`, `src/lib/quotes/lifecycle.{ts,test.ts}`, `prisma/schema.prisma`.
2. Activity-bump wiring across all event hooks: the actions + api/route file edits.
3. State-driven blue button + "Your move" section + follow-up compose swap: `src/app/(app)/offers/page.tsx`, the two button components, `ProposalCoverLetterDemo.tsx` template swap.
4. Service-type modal icons + `.theme-dark`: `src/app/globals.css`, `src/app/(app)/offers/OffersListControls.tsx`.
5. Offer-ID column circular icons + move test marker: `src/app/(app)/offers/page.tsx`.
6. Hourly Stripe Payment Element + staff-preview banner + new-tab links: `HourlyPublicView.tsx`, `OfferProposalPreview.tsx`, `(proposal)/proposal/[token]/page.tsx`, `HourlyOfferBuilder.tsx`, `ProposalAppDemoHeader.tsx`, `ProposalCoverLetterDemo.tsx` external-link.
7. READY stage refinement + mark-as-sent fallback + self-heal on first view: lifecycle stage additions, `(proposal)/proposal/[token]/page.tsx` self-heal, `ProposalCoverLetterDemo.tsx` mark-as-sent button.
8. Typography floor pass (§14): the 5 files listed under §14 above. Reviewable on its own — the diff is almost entirely `text-sm|text-xs|text-[11px] → text-sm|text-base` swaps plus two heading bumps.
9. HANDOFF refresh (this file).

Or squash into one commit if you'd rather not manage the split — the batch is coherent as a single "work-item lifecycle + hourly + preview safety" landing.

### 29) Offer-builder step URLs + Services step redesign — IN PROGRESS on `feature/services-step-redesign`

Supersedes §28's stepper description. Nothing here is pushed.

**Step URLs renamed to match their pill labels**

| pill | was | now |
|---|---|---|
| Contact | `/offers/new` | `/offers/contact` |
| Complexity | `/offers/pricing` | `/offers/complexity` |
| Adjustments | `/offers/calculator` | `/offers/adjustments` |

`/offers/pricing` was the Complexity step while `/offers/calculator` was the pricing step — `pricing` meant three different things depending on where you read it. Old paths redirect in `next.config.ts` (`permanent: false`) so in-flight draft links keep working. Internal step ids were renamed to match.

Also: the stepper's last pill split into **Publish** + **Email**, because `/offers/cover` passed `currentStep="cover"` which was not in `STEP_ITEMS`, so `findIndex` returned -1 and the whole progress bar rendered inert on the final step. The `included` and `preview` ids were removed from the union — neither was reachable.

**What the Services step investigation found**

The step felt clunky for reasons that were mostly structural, not visual:

- **It rendered all 146 active catalog rows**, each with five controls, no search, no grouping — including 25 `hourly-services` rows belonging to the separate `/offers/hourly` builder. Volume was the dominant problem.
- **`getProposalPreviewPackages` and `PACKAGES[].includedServices` were dead code.** The `20260830123500_catalog_core_package_services` migration had already moved the lead-facing lineup into `CatalogService.defaultPackageKeys`; the constant and its only reader were left behind. An early diagnosis in this session wrongly called those bullets client-facing — they never were.
- **`/offers/included` was an orphan.** It persisted to its own localStorage keys and reached neither the assessment nor the proposal.
- **The reorder chevrons were inert.** `optionsCatalogOrder` is read by neither `buildOptions` nor the public proposal schema, so it was stripped at publish.
- **The catalog editor silently destroyed the package lineup.** `services/actions.ts` read an `offerSection` form field that `ServicesCatalog.tsx` never rendered, so every save rewrote the row to `included-services`, demoting curated `core-services` rows. There was also no way to set `defaultPackageKeys` in the UI — that lineup was only maintainable by direct DB edits.
- **~110 of 146 services render on zero cards, silently.** `materializeProposalCatalog.ts` sets `defaultPackageIds: []` when `defaultPackageKeys` is absent, and `OfferProposalPreview.tsx`'s tier filter does `if (bonus.defaultPackageIds) return bonus.defaultPackageIds.includes(id)` — `[]` is truthy, so it returns false and short-circuits the legacy fallback.

**Landed so far**

- Both catalog queries scoped to `productKind: "bookkeeping"` (146 → 121), behind a new `catalogProductKind` schema capability.
- Deleted: the dead package bullets, `/offers/included` + `IncludedServicesBuilder`, the reorder controls, and `ProposalAppCollapsibleSection` / `ProposalAppExpandAllControl` once their last consumer went. Stale `revalidatePath("/offers/included")` calls removed from the contacts and services actions.
- `offerSection` and `defaultPackageKeys` are now editable in the catalog form, and `offerSection` is only written when present in the payload.
- Golden fixtures: all seven real snapshots (four offers, including the signed one and its published record) are committed redacted under `builder/__fixtures__`, with `offerServiceRows.test.ts` asserting the rows each package card renders. `buildOptions` is now exported for this; it is pure but its file's import graph reaches the offer server actions, so the test stubs that leaf rather than extracting ~1400 lines to reach it. **Extracting the pure pricing/selector layer out of `ProposalCreationWorkspaceDemo.tsx` is still worth doing** — the stub is a shortcut, not a solution.

**⚠ The most important finding: tiers are NOT purely cumulative**

A design panel and this agent all converged on modelling tier membership as `includedFrom: PackageId` — "the lowest tier that gets this, everything above inherits." **That model is wrong and would have corrupted a signed proposal.** The client-support family is *substituted* per tier, not inherited:

- `standard-client-support` → `["maintain"]` alone
- `priority-client-support` → `["improve"]` alone
- `concierge-client-support` → `["grow"]`

Under a floor model, Standard Client Support resolves to "from Maintain up" and renders on all three cards, putting three support levels on the Grow card.

The correct shape is a **contiguous tier range** (`{from, to}`): "from Maintain up" is `maintain→grow`, "Maintain only" is `maintain→maintain`. Non-contiguous sets stay unrepresentable, and an audit of live data confirms none exist. `offerServiceRows.test.ts` pins contiguity as the invariant.

The earlier audit that misled the panel checked only whether a selection *skips* a middle tier. Single-tier assignment is a different property, and it was not tested. Do not re-derive a floor model.

**Decided but not yet implemented**

New offers will open with only the catalog-curated lineup: a service with no `defaultPackageKeys` defaults to out-of-offer. Today `proposalCatalogSync.ts` ends `return legacySelections[item.offerKey] ?? true`, so every `optional` catalog row auto-enters each proposal as a paid add-on on all three cards — the reason staff hand-hide ~2.75 options per offer via the eye icon. This changes what a *new* proposal contains; existing offers normalize from their persisted state and must never be routed through the default rule.

**Next, in order**

1. The two rendering bugs, now that the golden test can prove what changes: the `[]`-is-truthy fallback, and `billEvery: "1 Month"` hardcoded on add-on rows (`ProposalAdditionalOption` has no cadence field, so a one-time optional service — e.g. sales-tax filing at $650 — prints to the prospect as `$650/mo`).
2. The tier-range model plus its read-time normalizer, with the substitution case as an explicit test.
3. The step UI: scoped default view (~15 rows, not 146), a contiguous-range control replacing the three package circles, and an add-on tail so a service can be included at Improve *and* purchasable at Maintain.

**Live data as of this session** — 4 offers total (2 draft, 1 accepted/signed, 1 archived); 146 active catalog services (121 bookkeeping / 25 hourly); `defaultPackageKeys` populated on exactly the 36 `core-services` rows; `defaultPrice > 0` on 41.

Validation: TypeScript OK, ESLint OK (1 pre-existing `no-img-element` warning), `next build` OK, 58 files / 385 tests OK.

### 30) Services step redesign implementation — DONE locally, uncommitted

The visible Services/Options redesign is now implemented on `feature/services-step-redesign`.

- New offers use only catalog-curated bookkeeping services in the standard package lineup. Optional catalog services remain in a separate add-on tail and start hidden from the lead.
- Package membership is represented by a contiguous range (`from`/`to`) in the UI and persisted through the existing package-id arrays. Legacy non-contiguous arrays are normalized at read time by filling the missing middle tier.
- The builder replaces the three independent package circles with range controls for `Included in` and `Available as add-on`. A priced core service can therefore be included in Improve/Grow and offered as a paid add-on for Maintain.
- Catalog cadence now travels through the assessment, templates, materialization, and public allowlist. One-time optional services are no longer labeled `$X/mo` in the public preview.
- Existing persisted offers retain their current option/bonus set and are not routed through the new-offer default rule.

Validation: `npm run typecheck` ✅ · `npm test` ✅ (59 files / 388 tests) · focused ESLint ✅ (one pre-existing `no-img-element` warning) · `npx next build` ✅. The `npm run build` wrapper still hits the known Windows Prisma query-engine DLL lock during `prisma generate`; stop the dev server before running that wrapper.

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
git status --short                        # should show the uncommitted §28 files listed above
git log -5 --oneline                      # latest committed work starts at 776316a
npm run typecheck                         # should be clean
npm test                                  # 57 files / 370 tests as of §28
```

Then read this file top-to-bottom. §28 is the latest work and is not yet committed or pushed. The user's push policy remains "never push without explicit user instruction".

If the user asks you to move CRM PipelineItem into the work-item model, read section 6 first, then the "Future design: unified work items / next-action system" CRM extension list — the offer-side helpers (`src/lib/quotes/lifecycle.ts`) are the pattern to follow.

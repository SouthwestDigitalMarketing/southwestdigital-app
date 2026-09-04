# Coding-agent handoff

Updated: 2026-09-04 (America/Chicago) — manage-offers workflow and handoff refreshed.

## Start here

- Read `AGENTS.md` before changing code. Its tenant, authorization, secret-handling, analytics, migration-safety, and Next.js 16 rules are non-negotiable.
- Current branch: `main`. Deployment is on **Vercel** (not Netlify — that's stale in older docs). Vercel CLI is not installed; use dashboard for env vars until user installs `npm i -g vercel`.
- `.claude/` is untracked user-owned content. Do not modify.
- Never commit `.env.local` or any secret. `AUTH_SECRET`, `ZOHO_MAIL_CLIENT_ID`, `ZOHO_MAIL_CLIENT_SECRET`, `INTEGRATION_ENCRYPTION_KEY`, Stripe/PayPal keys, and Supabase URLs are all secrets.

## Push policy

The user has instructed: **never push without explicit user instruction**. Commit locally at every phase boundary so work is preserved; leave push to the user. If a phase is done and unpushed, say so in "Current commit state" below.

## Current commit state

- Latest commit on `origin/main`: `2731c3a Document product-kind architecture and mark refactor complete`
- **Local, not yet pushed:** 20 commits, beginning with `7cceef5` and ending with `da2c537`.
- The local commits cover the manage-offers modal, contact fields, client/tag creation, action styling/order, send/resend behavior, duplicate markers, published proposal viewing, progressed-edit warnings, draft editing, and relative last-sent age. Run `git log --oneline origin/main..HEAD` for the complete list.

Run `git log --oneline origin/main..HEAD` to see what's ahead of origin.

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
- `HourlyPublicView` shows a "PaymentIntent ready" placeholder instead of a Stripe Payment Element. The PaymentIntent + Connect-safety + hourly amount resolver are all live; wiring the actual `<Elements>` renderer for hourly is a short follow-up (see the existing bookkeeping `OfferProposalPreview` for the Stripe Elements pattern).
- Receipt page (`/proposal/[token]/receipt`) still assumes bookkeeping snapshot shape; hourly receipts will show odd blanks until the receipt is made kind-aware.
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
git status --short
git log --oneline origin/main..HEAD    # what's committed locally but not pushed
npm run typecheck
npm test -- --run
```

Then read this file top-to-bottom, note which phase of the Product Type refactor is in progress (search for "IN PROGRESS" and the latest phase-completion commit), and continue from there.

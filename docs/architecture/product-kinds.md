# Product kinds

An **offer kind** (aka product kind) is the top-level dimension that tells the app which product shape it is dealing with. Every `Quote` carries a `kind` String; every `Engagement` and `CatalogService` carries a matching `productKind`. `AgreementTemplate` has an optional `defaultForProductKind`.

## The kinds

Defined in `src/lib/quotes/kinds.ts` as `OFFER_KINDS`:

| Key | Shape | Payment | Public preview |
|---|---|---|---|
| `bookkeeping` | Tiered monthly package + optional cleanup + onboarding fee + add-ons | Onboarding + cleanup (or onboarding + first month) at signing; monthly recurring after | `OfferProposalPreview` |
| `consulting` | Single hourly service × quantity + optional intake fee | Full total upfront | `HourlyPublicView` |
| `coaching` | Single hourly service (typically a session pack) × quantity + optional intake fee | Full total upfront | `HourlyPublicView` |
| `referral-network` | Partner referral offer (staff-facing, not a client-facing proposal) | — | Dedicated `/offers/referral` page |

Only `bookkeeping`, `consulting`, and `coaching` produce Engagements that a client can sign and pay.

## Data model

- `Quote.kind` (String, defaults `bookkeeping`) — source of truth for the offer's kind.
- `Engagement.productKind` (String, defaults `bookkeeping`) — set from the linked Quote at engagement creation.
- `CatalogService.productKind` (String, defaults `bookkeeping`) — services are visible only in offers of their matching kind.
- `AgreementTemplate.defaultForProductKind` (String?, nullable) — only one active template per brand can be default for a given kind.

Fields are Strings (not Prisma enums) to keep the existing `Quote.kind` semantics intact and avoid introducing a redundant enum column. `isOfferKindKey` (application-level) validates values.

## Adding a new kind

1. Add the key to `OFFER_KINDS` in `src/lib/quotes/kinds.ts` with `name`, `summary`, and `href`. If it's a client-facing hourly/session product, also add it to `HOURLY_OFFER_KINDS` and reuse the `/offers/hourly` builder.
2. If it needs a new builder route, mirror `/offers/hourly/{page.tsx,HourlyOfferBuilder.tsx,actions.ts}`.
3. Extend the public dispatcher in `src/app/(proposal)/proposal/[token]/page.tsx` to render the matching preview.
4. If the payment shape differs, extend `src/app/api/proposal/[engagementId]/payment-intent/route.ts` to dispatch on `engagement.productKind` and produce a fresh `amountDueNow` via a per-kind resolver (see `resolveHourlyAmountDueNow` in `src/lib/engagements/hourlyCheckout.ts` for the pattern).
5. Extend the sign route's tier-check gating if the new kind doesn't have tiers.
6. Add starter catalog services in a seed migration analogous to `20260904191000_seed_hourly_catalog_services`.
7. Add a per-kind email template default in `defaultCopyForKind` inside `ProposalCoverLetterDemo.tsx`.
8. Add the value to `PRODUCT_KIND_OPTIONS` in `AgreementTemplatesManager.tsx` so users can set a default agreement template for it.

## Reusable, do not re-implement

- Stripe Connect + destination charges (`src/lib/stripe/connectPaymentPlan.ts`).
- Sign flow (`/api/proposal/[engagementId]/sign/route.ts`) — pass a bypass for kinds without tiers, but the signature capture and hash logic are shared.
- Signed PDF generation (`/api/proposal/[engagementId]/signed-document/route.ts`).
- Cancellation flow (`requestAgreementCancellationAction`).
- Zoho email send (`sendFromMembership`).
- Receipt page.

Each new kind should reuse these outright and only add a new *config* + *preview* + *checkout resolver*.

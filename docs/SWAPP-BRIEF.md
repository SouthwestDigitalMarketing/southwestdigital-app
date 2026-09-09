# SWapp — product and business brief

Orientation for anyone — human or agent — arriving at this repository without
context. It answers *what this is and how it makes money*. It does not carry
priorities (see `docs/SWAPP-REVIEW-AND-ROADMAP.md`), current branch state (see
`HANDOFF.md`), or engineering rules (see `AGENTS.md`).

Verified against `main` on 2026-09-08.

---

## 1. What SWapp is

**SWapp** (this repository, `southwestdigital-app`) is the private multi-brand
client-acquisition and delivery platform operated by **Southwest Digital
Marketing**, a d/b/a of **Lochside LLC**. Next.js 16, React 19, Prisma 6,
PostgreSQL on Supabase, deployed on Vercel.

Its core product is an **offer-to-payment workflow for bookkeeping firms**: take
an inquiry, assess and price the work, generate a tiered proposal, publish it to
a public link, and let the client select a package, sign it, and pay by card —
producing an engagement that can be handed into delivery.

The public marketing websites (bookkeepingconroe.com, southwestdigital.io and
the rest) live in **separate repositories**. This repo is the app only.

## 2. The business around it

Two customer journeys share one proof engine.

| Audience | Problem | Destination | Revenue |
|---|---|---|---|
| Business owner needing bookkeeping | Behind, uncertain, or spending too much time on the books | Bookkeeping Conroe consultation → catch-up and monthly bookkeeping | Services revenue — the real revenue today |
| Bookkeeper building a firm | Inconsistent sales process, unclear pricing, weak follow-up | Skool community, SWapp adoption, implementation help | SaaS + coaching — **not yet collected** |

The intended loop: **YouTube** demonstrates real firm-building work →
**Bookkeeping Conroe** produces operating experience and results → **Skool**
converts that into relationships, education and product feedback → **SWapp**
makes the method repeatable → consented case studies and referrals feed back in.

The defensible asset is the combination — a tested method, useful software,
ongoing education, and trusted relationships. Not any one of them alone.

Positioning proposed but **not yet validated**: *"Turn bookkeeping inquiries into
signed, paid clients — with a clear next step every day."* Initial target is
independent bookkeepers and small firms that already receive some inquiries and
sell recurring bookkeeping or catch-up work, with real-estate specialty as a
test niche rather than an assumed requirement.

**No SWapp price has been set.** The roadmap deliberately defers pricing until a
small paid cohort produces evidence on willingness to pay, support cost,
activation and retention.

## 3. Tenant model

One tenant level: **`Brand`**. There is no organization or agency layer, and
adding one requires an approved architecture decision.

```
User ──── BrandMembership ──── Brand
             role:   OWNER | ADMIN | MEMBER | VIEWER
             status: ACTIVE | SUSPENDED | INVITED
```

- Users have one global platform identity and reach a brand only through an
  explicit `BrandMembership`.
- `PlatformRole` (`NONE | ADMIN | OWNER`) is separate from brand role. A brand
  admin is not a platform admin.
- A brand can own multiple verified hostnames (`BrandDomain`); the entry
  hostname drives login theme and preferred active brand.
- Every tenant-owned record carries a required `brandId`.

Four brands are defined in `scripts/seed-initial-brands.mjs`: **Southwest
Digital Marketing**, **Bookkeeping Conroe**, **Contigo Accounting**, and
**Melbourne CFO** (`app.melbournecfo.com.au` — Australia). Bookkeeping Conroe is
the live proving ground.

Commercially this matters: multi-firm packaging has to be expressed as brands +
memberships + entitlements. It cannot be expressed as a new tenancy tier.

## 4. What the product does today

Staff navigation: Dashboard, Website, YouTube, Reviews · Contacts, CRM, Services,
Offers, Agreements, Discounts · Clients, Team, Media, Tags, Settings.

### Offers engine — the strongest asset

Four offer kinds (`src/lib/quotes/kinds.ts`, documented in
`docs/architecture/product-kinds.md`):

| Kind | Shape | Payment |
|---|---|---|
| `bookkeeping` | Tiered monthly package + optional cleanup + onboarding fee + add-ons | Onboarding + cleanup (or onboarding + first month) at signing; monthly recurring thereafter |
| `consulting` | Single hourly service × quantity + optional intake fee | Full total upfront |
| `coaching` | Session-pack, same shape as consulting | Full total upfront |
| `referral-network` | Staff-facing partner offer, not a client proposal | — |

Bookkeeping pricing runs through a rules engine (`src/lib/quotes/pricing.ts` and
`src/lib/quotes/engine.ts`) over transaction volume, complexity level, urgency and scale, on
top of brand-owned `ProposalPackage` / `CatalogService` / `PricingRule` records.
The builder is a multi-step flow — contact, intro, who, scale, complexity,
adjustments, cover, finalize — with a live client-facing preview in a second tab.

Supporting configuration: service catalog, discounts, agreement templates,
options templates, tags, media library, brand themes.

### Client-facing proposal flow

Public tokenized proposal page → package selection → e-signature capturing
agreement text, hash and signer evidence → **Stripe Connect destination
charges**, so money lands in the firm's connected account rather than the
platform balance → receipt page and signed PDF (`pdf-lib`) → agreement
cancellation flow. PayPal exists but runs on platform-wide credentials and
should stay disabled for external tenants.

### CRM and delivery

Contacts with tags and tag automations, leads with attribution touches,
pipelines with stages and items, clients, tickets, team meetings.

### Growth surfaces

GA4 website analytics, YouTube analytics with OAuth connect, goals and
period-over-period comparison on the dashboard, SMS review requests with a
public response page, source-tag click tracking.

### Operations plumbing

Per-member Zoho OAuth mailboxes (Gmail / Microsoft / SMTP show as "coming
soon"), R2/S3 media storage, encrypted brand integration registry, audit events,
brand offboarding and data-export job records, platform brand administration.

> **Caution on scale signals.** The schema has ~106 models, but a large share —
> timecards, contractor invoices, member onboarding, career paths, focus tools —
> is inherited internal-operations schema, not shipped product. Do not count
> models as features.

## 5. The two money flows — never conflate them

| Flow | Who pays whom | State |
|---|---|---|
| **Firm service payment** | A bookkeeping client pays their bookkeeper through the firm's connected Stripe account | **Works** for at-signing charges. Destination-charge policy is enforced, and the accepted obligation is frozen and reconciled against amount, currency, destination, livemode and selection hash before an engagement is marked paid. |
| **SWapp subscription** | A bookkeeper's Brand pays Southwest for software | **Does not exist.** `Brand.subscriptionStartedAt` / `subscriptionEndedAt` are lifecycle date fields consumed by the platform and offboarding repositories. There is no plan, entitlement, invoice, renewal, dunning or seat logic anywhere in `src/`. |

Two further facts that constrain any revenue model:

- **Recurring monthly bookkeeping collection is not automated.** Recurring
  prices in a proposal are commercial terms; only the at-signing amount is
  actually charged. Anything assuming recurring auto-collection needs it built,
  or needs an explicit tracked handoff to the firm's existing billing process.
- Never imply that a one-time onboarding payment started a subscription.

## 6. Where it stands for monetization

A September 5 2026 internal review (`docs/SWAPP-REVIEW-AND-ROADMAP.md`) judged
the app substantial but **not safe to open to independent customer firms**. The
`feat/saas-readiness` branch has since merged to `main` and closed much of the
P0 list:

- Public proposal payloads use an allowlisted DTO — internal assessment notes no
  longer cross into the client browser payload.
- The Zoho OAuth relay verifies signed state before forwarding an authorization
  code, and requires an active brand and authorized return host.
- Shared brand settings and YouTube mutations require brand administration;
  staff keep their own mailbox connection.
- Logo uploads are decoded, bounded and re-encoded as WebP; raw SVG is rejected,
  including through the legacy same-origin asset proxy.
- Signed payment obligations are frozen and reconciled through one path.
- CI now runs typecheck, lint and unit tests on every PR to `main`.

**Still open, and revenue-blocking:**

1. **Tenant isolation is inconsistent.** Newer `/contacts` code queries Prisma
   directly rather than through the RLS transaction context, and a schema scan
   found ~23 models with a required `brandId` but no declared `Brand` relation.
   Needs reconciliation plus a two-brand runtime-role test before independent
   firms share a database.
2. **No subscription billing or entitlements** (§5).
3. **No first-run activation.** A new firm cannot self-serve brand setup,
   services and pricing, Stripe connection, mailbox, or agreement templates.
4. **Export and offboarding are job records with no worker**, so data
   portability cannot yet be promised.
5. **Review requests are not tenant-ready.** Links are built from `AUTH_URL`,
   which `src/auth.ts` rejects, so generated SMS links fall back to localhost;
   SMS credentials and the review destination are global environment values. The
   flow also solicits five-star reviews specifically, which conflicts with
   Google's review policy.
6. **Only Zoho is supported for outbound mail**, which may exclude much of the
   intended audience.
7. **Lifecycle metrics can mislead.** The offers list caps at 50 rows with no
   pagination, so follow-ups fall out of view; the dashboard excludes
   `completed`, so paid wins drop out of accepted/sent counts.
8. **Referral program, marketing automation and durable job infrastructure are
   design notes only.**

The roadmap sequences the work as: 1 protect data and money → 2 complete the
daily workflow → 3 make it coherent and beautiful → **4 paid SaaS pilot with
5–10 independent firms** → 5 prove customer outcomes → 6 referrals and
automation. Phase 4 is the earliest point at which SaaS revenue becomes real.

## 7. Constraints on any plan

- **Never push without explicit user instruction.** Commit locally; leave push
  to the user.
- No production deploys, migrations, outbound messages or payment transactions
  are authorized from an agent session.
- AI product features and marketing bots are explicitly **excluded** from the
  current implementation scope.
- Do not send authenticated portal activity, client identities or proposal
  contents to advertising platforms.
- Case studies and testimonials require a documented milestone, recorded
  baseline and period, participant permission, and disclosure of any incentive
  or affiliate relationship. Incentives must not depend on the endorsement being
  positive.
- Keep the two audiences distinguishable in calls to action and attribution: a
  business owner seeking bookkeeping and a bookkeeper seeking the method need
  different destinations.
- A Skool link click is not a verified community join; a YouTube view is not an
  identified prospect. Do not invent attribution.

# Initial brand seed

The guarded seed in `scripts/seed-initial-brands.mjs` creates the first platform records without trusting domains or activating client access.

## Seeded brands

| Brand | App hostname | Initial owner | Theme source |
| --- | --- | --- | --- |
| Southwest Digital Marketing | `app.southwestdigital.io` | `admin@southwestdigital.io` | `southwestdigital-web/src/app/globals.css` |
| Bookkeeping Conroe | `app.bookkeepingconroe.com` | `thomas@bookkeepingconroe.com` | `bookkeepingconroe-web/app/globals.css` |
| Contigo Accounting | `app.contigoaccounting.com` | `INITIAL_DAGNY_EMAIL` | `contigoaccounting-web` page and logo colors |
| Melbourne CFO | `app.melbournecfo.com.au` | `INITIAL_DAGNY_EMAIL` | `melbournecfo-web/src/app/globals.css` |

All brands are created as `DRAFT`. All app hostnames are created as `PENDING`. Domain verification and brand activation are separate cutover operations.

The seed inventories the existing public GTM container IDs found in the Southwest Digital, Contigo, and Melbourne CFO website source as `SOUTHWEST_DIGITAL`-owned, `PENDING` integration records. It does not invent GA4 properties, Meta Pixels, advertising accounts, or provider credentials.

`app.southwestdigital.io` is the Southwest brand's client-facing portal. The confirmed operator entry point is `https://admin.southwestdigital.io`; it must remain distinct from every brand hostname.

## Required environment

```text
ALLOW_INITIAL_BRAND_SEED=true
INITIAL_BOOKKEEPING_OWNER_EMAIL=thomas@bookkeepingconroe.com
INITIAL_PLATFORM_OWNER_EMAIL=admin@southwestdigital.io
INITIAL_DAGNY_EMAIL=dagnymotor@gmail.com  # optional default
PLATFORM_BASE_URL=https://admin.southwestdigital.io
DATABASE_URL=<target pooled or direct PostgreSQL URL>
```

The Southwest platform owner, `admin@southwestdigital.io`, is given `PlatformRole.OWNER`. The Bookkeeping Conroe brand owner, `thomas@bookkeepingconroe.com`, and the other brand owners are invited with `BrandRole.OWNER`. Existing active or suspended user and membership statuses are preserved; rerunning the seed does not reactivate or demote anyone.

## Safety and idempotence

- The script refuses to run unless the explicit safety flag is exactly `true`.
- Existing brand and integration lifecycle statuses are not reset.
- A hostname already attached to another brand aborts the transaction.
- The complete seed runs in one database transaction.
- The rehearsal runs the seed twice against disposable PostgreSQL and asserts that no tenant, domain, membership, theme, or integration is duplicated.

Do not run this against production until the production database target has been independently identified and backed up. This seed creates platform configuration only; it does not import legacy application records.

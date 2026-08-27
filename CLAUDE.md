# Southwest Digital App — Project Runbook

Next.js 16 / NextAuth v5 beta.32 / Prisma 6.19.3 / Supabase (PostgreSQL)

---

## Local dev setup

```bash
npm install
npm run dev          # starts on http://localhost:3000
```

Requires `.env.local` in the project root. Minimum required vars:

```
DATABASE_URL=          # Supabase transaction-mode pooler (port 6543)
DIRECT_DATABASE_URL=   # Supabase session-mode pooler (port 5432)
AUTH_SECRET=           # any random string, signs JWTs
```

Optional (enables those auth methods):
```
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_EMAIL_SERVER=
AUTH_EMAIL_FROM=
AUTH_URL=              # base URL, e.g. https://app.bookkeepingconroe.com
```

---

## What this app is

A multi-brand SaaS platform operated by Southwest Digital Marketing. Currently hosts one brand: **Bookkeeping Conroe** (`slug: "bc"`). Additional brands can be added by inserting `Brand` + `BrandDomain` + `BrandMembership` records.

The marketing websites (bookkeepingconroe.com, southwestdigital.io, etc.) live in separate repos. This repo is **the app only**.

---

## Architecture: brands and memberships

Every user has a global `User` record (platform identity). Access to a brand's data is granted via `BrandMembership`.

```
User ──────── BrandMembership ──────── Brand
                  │
                  └── role: OWNER | ADMIN | MEMBER | VIEWER
                  └── status: ACTIVE | SUSPENDED | INVITED
```

- **OWNER** — brand owner (Thomas for BC)
- **ADMIN** — payroll manager / admin
- **MEMBER** — employee or intern
- **VIEWER** — external client

Every tenant-owned record has a required `brandId` FK to `Brand`. Member-owned records use `membershipId` (FK to `BrandMembership.id`), not `userId`.

`PlatformRole` on `User` is separate: NONE / ADMIN / OWNER. Platform OWNER = can manage any brand. Brand OWNER = manages one brand.

---

## Authentication

### How it works

- **Production / staging**: email magic link (`nodemailer`) or Google OAuth
- **Local dev**: Credentials "dev-bypass" provider — enter email, instant login, no email sent

Session strategy: JWT. Prisma adapter is wired but sessions are not stored in DB.

### Dev login

1. `npm run dev`
2. Visit `/login`
3. Enter `thomas@bookkeepingconroe.com`
4. Click **Sign In** — logged in immediately

The dev-bypass provider looks up the user by email, checks `status === ACTIVE`, and creates the user if missing (as `PlatformRole.OWNER`).

### Dev login fails ("DevBypassUserNotActive")

Three causes, in order of likelihood:

**Cause 1 — User not ACTIVE in DB:**
```bash
node scripts/activateSuperAdmin.cjs
```
This ensures `thomas@bookkeepingconroe.com` exists as ACTIVE OWNER with a BC brand membership.

**Cause 2 — Stale Prisma client after schema change:**
```bash
# Stop dev server first, then:
npx prisma generate
npm run dev
```

**Cause 3 — Supabase cold start:** Try signing in again. If the Supabase free-tier project was paused, resume it at the Supabase dashboard.

The terminal always logs the real error cause:
```
[next-auth][error] ...
[next-auth][error][cause] ...
```

---

## Database

### Connection URLs

- `DATABASE_URL` — transaction-mode pooler (`port 6543`, pgbouncer). Used for all runtime Prisma queries.
- `DIRECT_DATABASE_URL` — session-mode pooler (`port 5432`). Required for schema operations (`prisma db push`, `prisma migrate deploy`).

### ⚠️ Never use port 6543 for schema operations

`prisma db push` or `prisma migrate` against port 6543 (transaction-mode pgbouncer) will hang on connection teardown after applying the schema. Always use `DIRECT_DATABASE_URL` (port 5432) for these commands. The `.env.local` already has this wired correctly — don't override `DIRECT_DATABASE_URL` in scripts.

### Applying schema changes

For new schema changes, use `prisma db push` (dev) or `prisma migrate deploy` (prod). Do not use `prisma migrate dev` — the migration history has known drift.

```bash
# Dev — apply schema changes:
npx dotenv-cli -e .env.local -- npx prisma db push

# After any schema change, regenerate the client:
npx prisma generate
```

### Migration history

This DB was migrated from the old `bookkeepingconroe-web` single-brand schema on 2026-08-16. The migration history does not match the current schema. `prisma migrate dev` will complain about drift — use `prisma db push` instead.

---

## Key files

| Path | Purpose |
|------|---------|
| `prisma/schema.prisma` | Full multi-brand schema (~1100 lines) |
| `src/auth.ts` | NextAuth v5 config — providers, JWT/session callbacks |
| `src/auth.config.ts` | Edge-compatible auth config (empty providers) |
| `src/lib/prisma.ts` | Prisma singleton with stale-client detection |
| `src/lib/brands/hostname.ts` | `normalizeHostname()` utility for brand resolution |
| `src/app/login/page.tsx` | Login page — supports dev bypass, Google, email magic link |
| `src/types/next-auth.d.ts` | Session type extensions (`platformRole`, `status`) |
| `src/app/api/auth/[...nextauth]/route.ts` | Auth route with `x-forwarded-host` handling for Netlify |

---

## Common scripts

| Command | Purpose |
|---------|---------|
| `node scripts/activateSuperAdmin.cjs` | Ensure thomas@bookkeepingconroe.com is ACTIVE OWNER with BC membership |
| `npx prisma generate` | Regenerate Prisma client after schema changes |
| `npx dotenv-cli -e .env.local -- npx prisma studio` | GUI to inspect/edit the database |
| `npx dotenv-cli -e .env.local -- npx prisma db push` | Apply schema to DB (dev) |

---

## Deployment

Hosted on **Netlify**. Build command: `npm run netlify-build` (`prisma generate && next build`).

Environment variables are set in Netlify → Site → Site configuration → Environment variables. A redeploy is required to pick up changes.

The `x-forwarded-host` header is trusted in the auth route for Netlify's reverse proxy.

---

## What's built so far

- Multi-brand schema (fully migrated from BC)
- NextAuth v5 with dev-bypass, Google, and email magic link providers
- Login page (`/login`)
- Homepage placeholder (`/`) — "Multi-brand platform foundation" screen

**Not yet built:** any authenticated routes, brand resolution middleware, dashboard, or app features. Everything after login is a blank slate.

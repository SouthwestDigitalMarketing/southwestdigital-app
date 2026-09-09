# Local development

Setup and day-to-day commands. Rules live in `AGENTS.md`; current branch state
lives in `HANDOFF.md`.

## Setup

```bash
npm install
npm run dev          # http://localhost:3000
```

Requires `.env.local` in the project root. Minimum to boot:

```
DATABASE_URL=          # Supabase transaction-mode pooler (port 6543)
DIRECT_DATABASE_URL=   # Supabase session-mode pooler (port 5432)
AUTH_SECRET=           # any random string, signs JWTs
```

Optional variables enable individual auth methods and integrations — the full
table is in `docs/deployment/environment-variables.md`.

> **`AUTH_URL` and `NEXTAUTH_URL` must stay unset.** `src/auth.ts` throws at
> import if either is present, because the deployment serves multiple trusted
> hostnames. Set `PLATFORM_BASE_URL` instead.

`npm run dev` is written in `cmd` syntax (`set NODE_OPTIONS=... && ...`). Under
bash the prefix silently no-ops, so the server starts but `NODE_OPTIONS` is
never applied.

## Signing in locally

Production and staging use an email magic link (`nodemailer`) or Google OAuth.
Local development additionally enables a Credentials **dev-bypass** provider:
enter an email, sign in instantly, no message sent.

1. `npm run dev`
2. Visit `/login`
3. Enter `thomas@bookkeepingconroe.com`
4. **Sign In** — logged in immediately

The provider looks the user up by email, requires `status === ACTIVE`, and
creates the user as `PlatformRole.OWNER` if missing.

Session strategy is JWT. The Prisma adapter is wired, but sessions are not
stored in the database.

### "DevBypassUserNotActive"

Three causes, in order of likelihood.

**1 — the user is not ACTIVE in the database:**

```bash
node scripts/activateSuperAdmin.cjs
```

Ensures `thomas@bookkeepingconroe.com` exists as an ACTIVE OWNER with a
Bookkeeping Conroe membership.

**2 — a stale Prisma client after a schema change:**

```bash
npx prisma generate
npm run dev
```

On Windows the dev server holds `query_engine-windows.dll.node`, so stop it
first. On Linux there is no such lock.

**3 — Supabase cold start.** Try again; resume the project from the Supabase
dashboard if it was paused.

The terminal always logs the real cause as `[next-auth][error]` and
`[next-auth][error][cause]`.

## Checks

```bash
npm run typecheck
npm test             # vitest
npm run lint
npm run test:e2e     # Playwright; needs a dev server and a reachable database
```

CI (`.github/workflows/ci.yml`) runs typecheck, lint and unit tests on every PR
and push to `main`. Playwright is deliberately excluded — it needs secrets and a
real database.

## Database

- `DATABASE_URL` — transaction-mode pooler, port 6543, pgbouncer. All runtime
  Prisma queries.
- `DIRECT_DATABASE_URL` — session-mode pooler, port 5432. Every schema
  operation.

**Never point a schema operation at port 6543.** Against transaction-mode
pgbouncer it hangs on connection teardown after applying the schema.
`.env.local` is already wired correctly; do not override `DIRECT_DATABASE_URL`
in scripts.

**Before running any Prisma command against a real database, read
`docs/deployment/database-migration-state.md`.** The migration history is
divergent from the schema: `prisma migrate deploy` and `prisma migrate dev` must
not be used, and changes are applied as reviewed idempotent SQL instead.

```bash
npx prisma generate                                        # after any schema change
npx dotenv-cli -e .env.local -- npx prisma studio          # inspect/edit data
```

## Useful scripts

| Command | Purpose |
|---|---|
| `node scripts/activateSuperAdmin.cjs` | Ensure the super admin is ACTIVE with a BC membership |
| `npm run seed:initial:local` | Seed the four operating brands and their domains |
| `node scripts/seedOptionsTemplates.cjs` | Seed client-ready proposal options templates |
| `npx prisma generate` | Regenerate the Prisma client |

The `*.ps1` scripts under `scripts/` and the `test:*:windows` npm scripts are
Windows-only and cannot run on the current Linux development machine.

## Deployment

Deployed on **Vercel**. Build runs `prisma generate && next build`. Environment
variables are set in the Vercel project settings and require a redeploy to take
effect. `netlify.toml` and any Netlify instructions in older documents are
historical.

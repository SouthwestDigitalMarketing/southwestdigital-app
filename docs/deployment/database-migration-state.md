# Database and migration state

Moved out of `HANDOFF.md` on 2026-09-08. Read this before running any Prisma
command against a real database.

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


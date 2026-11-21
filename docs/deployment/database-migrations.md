# Database migrations

Since 2026-11-18 SWapp uses the standard Prisma workflow: every schema change
is a migration file in `prisma/migrations/`, reviewed in a pull request, and
applied to production automatically by the production deploy.

## The rules

1. **Development never touches production.** Local work uses the Docker
   database in `docker-compose.yml`. Production credentials live in Vercel,
   and on ripley in `~/.config/swapp/prod-db.env` for read-only operator
   tools. They never go in the repo's `.env` or `.env.local`.
2. **Change the schema with `prisma migrate dev`, locally.** It writes the
   migration file and applies it to the local database.
3. **Never hand-apply SQL to production.** No `prisma db execute`,
   `prisma db push`, `prisma migrate reset` or ad hoc DDL against production.
   A change applied by hand would be applied a second time by the deploy.
4. **Migrations are additive.** The deploy migrates before it builds, so for
   a few minutes the old code runs against the new schema. Add columns and
   tables; remove or rename in a later release, after no deployed code uses
   the old shape (expand, then contract).
5. **Prisma cannot express everything.** Check constraints, partial indexes,
   row-level security and policies go in the migration SQL by hand. Run
   `npx prisma migrate dev --create-only`, edit the SQL, then
   `npx prisma migrate dev` to apply it.

6. **Never run `SET` or `RESET` on the production pooler (`DATABASE_URL`,
   port 6543, transaction mode).** The setting sticks to a shared server
   connection the app also uses. On 2026-11-20 a read-only check ran
   `set default_transaction_read_only=on` there and every SWapp write failed
   for 9 minutes. For a safe read use
   `psql -1 -c "SET TRANSACTION READ ONLY; select ..."` (it ends with the
   transaction). Recovery steps: All Thing `sops/troubleshooting.md`.

## Everyday workflow

```bash
docker compose -p swapp-dev up -d          # local Postgres on 127.0.0.1:5434
npx prisma migrate deploy                  # first time: build the local schema
# edit prisma/schema.prisma
npx prisma migrate dev --name short_description
```

`.env` for local work:

```
DATABASE_URL="postgresql://swapp:swapp@127.0.0.1:5434/swapp"
DIRECT_DATABASE_URL="postgresql://swapp:swapp@127.0.0.1:5434/swapp"
```

## How production gets migrated

- `vercel.json` sets the build command to `scripts/vercel-build.sh`.
- When `VERCEL_ENV=production`, it runs `prisma migrate deploy` (through
  `DIRECT_DATABASE_URL`, the session pooler on port 5432), then `npm run build`.
- Preview builds skip migrations. Previews share the production database, so
  a preview must never change its schema.
- If a migration fails, the build stops and the previous deployment keeps
  serving. Fix forward with a new migration. Use
  `prisma migrate resolve` only after reading the failure.

CI (`migrations match schema` in `.github/workflows/ci.yml`) builds an empty
database from the migrations and fails the PR if it differs from
`schema.prisma`.

## The 2026-11-18 baseline

Before this date the migration history did not match production: changes had
been applied by hand, and Prisma reported `last common migration: null`. The
fix, done on 2026-11-18:

- `prisma/schema.prisma` was reconciled with production (missing foreign
  keys, defaults, an index and an index name).
- `prisma/migrations/0_init` is one migration that recreates production's
  `public` schema exactly, including what Prisma cannot model. A database
  built from it was compared with production: columns, enums, constraints,
  indexes, RLS and policies matched. The only intended difference is fixed by
  `20261118210000_options_template_default_unique`.
- On production, SWapp's 9 old rows were removed from `_prisma_migrations`
  and `0_init` was marked applied with `prisma migrate resolve --applied`.
  That changes no tables.
- The old migrations are kept, unused, in `prisma/migrations-archive/`.
- A full backup taken first is on ripley at
  `~/backups/swapp-db/prod-20261118T200824Z.dump`. A test restore had all
  145 tables, with matching row counts.

## Shared database (known follow-up)

Uncle Invoice uses the same Supabase database: its tables are in the
`uncleinvoice` schema, but its Prisma migration rows sit in the same
`public._prisma_migrations` table as SWapp's. Prisma tolerates this: a
rehearsal on a production copy showed each app's `migrate deploy` and
`migrate status` succeed with the other app's rows present, including newer
ones. The clean end state is separate logbooks (Uncle Invoice's database URLs
gain `schema=uncleinvoice`, after its rows are copied into
`uncleinvoice._prisma_migrations`). Longer term,
[database-hosting.md](database-hosting.md) recommends SWapp gets its own
Supabase project.

# Coding-agent handoff

## Current product issue

The Offers → Options step should be catalog-backed and visually clear about which rows are included. The current UI now dims unchecked optional rows, has no zebra striping, places Include before Service, and uses borderless but large/focusable up/down chevrons.

## Implemented in this branch

- Proposal option catalog fields and applicability rules were added to `CatalogService`.
- The Options page reads catalog options when the database supports the new schema and falls back safely while the migration is pending.
- “QuickBooks to Stessa Migration” is represented as a catalog option with real-estate, migration, and Stessa applicability rules.
- Tag assignment editing is controlled, persistent, shows the saved count, warns before discarding changes, and rejects duplicate real-estate tags.
- Published proposals use immutable numbered `QuoteRevision` snapshots. Catalog edits do not mutate an already-published snapshot; an intentional republish creates the next version.
- A `schemaCapabilities` compatibility check allows the app to run against the current pre-migration database without Prisma P2022/P1012 runtime failures.
- `<body suppressHydrationWarning>` handles the `cz-shortcut-listen` attribute injected by a browser extension.

## Important current database state

The `20260829120000_catalog_options_and_quote_revisions` migration was applied against Supabase on 2026-08-29 (raw SQL, wrapped in a single transaction, recorded in `_prisma_migrations`). A pre-migration `pg_dump` is at `backups/backup-pre-catalog-options-20260829T182501Z.sql` (gitignored) for rollback via `psql`.

Migration history drift persists: the DB contains a consolidated `20260817205118_init` (plus the 3 theme migrations and now this one), while the repo has 17 migration folders whose schema is already present in the DB via that init. **Do not run `prisma migrate deploy` blindly** — it will try to reapply the 13 consolidated migrations. For new schema changes, keep using `prisma db push` (dev) or raw-SQL migrations with a manual `_prisma_migrations` row.

Post-migration reconciliation (BC brand):
- 43 catalog services (29 pre-existing + 14 seeded proposal options), 15 real-estate-specific
- Canonical `real-estate` tag active; duplicate `real-estate-bookeeper` archived (isActive=false, not deleted)
- 1 `quote_revisions` row backfilled from the 1 published quote snapshot

## Known follow-up

None open. `Per-Property Class Tracking` is now a catalog-backed bonus with real-estate applicability and monthly billing cadence — configurable via `/offers/add-ons` per-proposal and via `/services` at the brand-catalog level.

## Verification already run

- `npm test`: 114 tests passed
- `npm run typecheck`: passed
- focused ESLint on changed files: passed
- `npm exec dotenv -- -e .env.local -- prisma validate`: passed
- `npm exec next -- build`: passed
- authenticated local Offers → Options request returned HTTP 200 after the compatibility layer and Prisma regeneration

The dev server may be running on port 3000. The Vercel CLI is not installed in this environment.

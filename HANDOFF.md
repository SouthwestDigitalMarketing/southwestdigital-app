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

The connected database does **not** yet have `catalog_services.offer_key` or the other new catalog columns. It also has migration-history drift: the database contains `20260817205118_init`, while this repository has a different migration history. Do not run `prisma migrate deploy` blindly.

The current brand’s data was inspected read-only:

- canonical active tag `real-estate`: 0 service assignments
- duplicate active tag `real-estate-bookeeper`: 10 service assignments
- 29 existing catalog services

The additive/data-reconciliation migration is staged at `prisma/migrations/20260829120000_catalog_options_and_quote_revisions/migration.sql`, but has not been applied. Before applying it, take a backup, rehearse on a restored copy, baseline/reconcile the divergent migration history, run the included reconciliation queries, and document rollback. The migration archives the duplicate tag rather than deleting it.

## Known follow-up

`Per-Property Class Tracking` is still hard-coded in `OfferProposalPreview.tsx` for Grow and Improve. The desired end state is to move it into catalog/package rules and make its visibility depend on the relevant real-estate applicability, instead of injecting it whenever the package is not Maintain.

## Verification already run

- `npm test`: 114 tests passed
- `npm run typecheck`: passed
- focused ESLint on changed files: passed
- `npm exec dotenv -- -e .env.local -- prisma validate`: passed
- `npm exec next -- build`: passed
- authenticated local Offers → Options request returned HTTP 200 after the compatibility layer and Prisma regeneration

The dev server may be running on port 3000. The Vercel CLI is not installed in this environment.

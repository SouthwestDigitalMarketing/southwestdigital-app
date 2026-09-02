# Coding-agent handoff

Updated: 2026-09-01 (America/Chicago)

## Start here

- Read the repository `AGENTS.md` before changing code. Its tenant, authorization, secret-handling, analytics, migration-safety, and Next.js 16 rules are non-negotiable.
- Current branch: `main`.
- Current pushed commit: `6a89195 Make proposal package services configurable`.
- At the time of this update, `main`, `origin/main`, and `origin/HEAD` all point to `6a89195`.
- `HANDOFF.md` itself is updated after that commit and is therefore an uncommitted working-tree change.
- `.claude/` is untracked user-owned content. Do not add, delete, or modify it unless the user explicitly requests that.

## Current product state

The Offers → Options step is now the per-offer source of truth for optional services, included services, cadence, and Grow/Improve/Maintain assignments.

The latest work completed all of the following:

- Removed every `Why shown: ...` explanation from the Options table.
- Removed the Options table's `Real estate` column and toggle. Real-estate designation is derived from the service's `Real estate` tag through the Services/Tags management flow.
- Changed the Edit/Done action to an accessible icon-only pencil/check button.
- Removed the lead proposal preview's hard-coded recurring service lineup.
- Moved these former runtime constants into brand-owned `CatalogService` rows:
  - Monthly Bookkeeping
  - Standard Client Support
  - Monthly Reporting Package
  - Priority Client Support
  - Investor Reporting & KPI Review
  - Concierge Client Support
  - Monthly Advisory Calls
  - CFO Pack
  - Cash Flow Analysis
- Added catalog-backed default package assignments, stored in `catalog_services.default_package_keys`.
- Existing and new offer drafts receive newly cataloged core services without duplicating a service that a user converted from Included to Optional.
- Per-offer package selections are stored in `assessment.bonusPackageSelections` and frozen into saved/published offer snapshots.
- Catalog-backed rows are archived rather than destructively removed when the trash action is used, so they do not immediately rematerialize.
- The lead preview derives recurring rows and tooltips from the configured service names/descriptions.
- Package monthly totals remain driven by the pricing calculator, independently of how the service total is displayed internally.
- `Everything in [lower tier], plus:` is only shown when the higher tier actually contains the lower tier's configured recurring services. Otherwise, the preview lists the actual selected services without making the inheritance claim.
- The comparison modal now derives its recurring/one-time service matrix from configured rows; its separate hard-coded bookkeeping/support feature matrix was removed.

Primary implementation files:

- `src/app/(app)/offers/add-ons/page.tsx`
- `src/app/(app)/offers/builder/ProposalAddOnsDemo.tsx`
- `src/app/(app)/offers/builder/ProposalCreationWorkspaceDemo.tsx`
- `src/app/(app)/offers/builder/OfferProposalPreview.tsx`
- `src/lib/quotes/catalog.ts`
- `src/lib/quotes/materializeProposalCatalog.ts`
- `src/lib/database/schemaCapabilities.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20260830123500_catalog_core_package_services/migration.sql`

## Database and migration state — read before running Prisma commands

The connected `.env.local` database is Supabase PostgreSQL. Do not expose its connection string or credentials.

Prisma migration history is divergent:

- The database contains the consolidated migration `20260817205118_init`, which is not present in this repository.
- Several repository migrations describe schema already provided by that consolidated database migration.
- `prisma migrate status` reports `last common migration: null` and treats 13 local migrations as pending even though most of that schema already exists.
- **Do not run `prisma migrate deploy` or blindly run `prisma migrate dev`.** Either could try to replay consolidated schema migrations.

Known applied catalog migrations:

1. `20260829120000_catalog_options_and_quote_revisions`
   - Applied previously as reviewed raw SQL and recorded in `_prisma_migrations`.
   - Pre-migration backup: `backups/backup-pre-catalog-options-20260829T182501Z.sql` (gitignored).
2. `20260830123500_catalog_core_package_services`
   - Adds nullable JSONB `catalog_services.default_package_keys`.
   - Seeds nine `core-services` catalog rows per existing brand with conflict-safe defaults.
   - Applied directly with `prisma db execute` after `migrate status` exposed the divergent history.
   - The SQL is idempotent (`ADD COLUMN IF NOT EXISTS` and conflict-safe inserts).
   - It was **not** recorded with `prisma migrate resolve`, so Prisma may still report this migration as pending.

Post-apply database assertion succeeded:

- `catalog_services.default_package_keys` exists.
- Every current brand has at least nine `offer_section = 'core-services'` rows.

The app now has a rollout compatibility guard:

- `getSchemaCapabilities()` detects `proposalPackageDefaults` separately from the older proposal catalog capability.
- Catalog queries only select `defaultPackageKeys` when the column exists.
- This prevents the Prisma P2022 runtime failure seen when application code was ahead of the database migration.

If another schema change is needed, first inspect migration status and the actual database schema. Prefer a reviewed, additive, idempotent SQL migration with explicit reconciliation. Do not alter production destructively without the backup/rehearsal/reconciliation/rollback process required by `AGENTS.md`.

## Verification completed

After the latest code and compatibility fix:

- `npm run typecheck`: passed.
- `npm test`: 19 files passed, 117 tests passed.
- Focused ESLint on the new catalog, capability, and Options code: passed.
- Database migration script: executed successfully.
- Direct database assertion for the new column and nine rows per brand: passed.
- `git diff --check`: passed before commit.
- Commit `6a89195` was pushed successfully to `origin/main`.

The in-app browser was unavailable for the final post-migration authenticated visual reload. The next agent should begin by loading `/offers/add-ons` with an authenticated staff session and confirm:

1. The page renders without a Prisma missing-column error.
2. The nine core recurring services appear in the Options table.
3. Package checkboxes match their seeded defaults.
4. Editing names/descriptions or package assignments changes the embedded/public proposal preview.
5. Removing a lower-tier service from a higher tier suppresses the `Everything in ...` inheritance claim.

## Important behavior and remaining considerations

- **Deferred Stripe Connect safety work — required before enabling live proposal payments, but not required to continue composing and sending test offers:**
  - The payment-intent route currently omits `transfer_data.destination` when a brand has no active Stripe connected account. That fallback creates the charge on Southwest Digital Marketing's platform account. Replace it with a clear blocking response so a proposal cannot collect payment until its brand has an active connected account.
  - A PaymentIntent created before the brand's connected account becomes active remains platform-only. The existing update path changes only the amount and receipt email; it cannot retrofit the destination. Detect a missing or mismatched destination and cancel/recreate an unpaid PaymentIntent for the active brand connected account.
  - Add route-level tests proving that a brand cannot pay into another brand's connected account, a missing/inactive connection blocks payment, and a stale platform-only PaymentIntent is replaced.
  - Confirm the intended merchant-of-record, Stripe-fee, refund, and dispute responsibilities before live launch. The current destination-charge design transfers the gross payment to the connected Express account while Southwest Digital Marketing's platform balance remains responsible for processing fees, refunds, and disputes.
- Lead-facing recurring service names/descriptions are no longer hard-coded in `OfferProposalPreview.tsx`; the migration contains initial seed values that become editable brand catalog data.
- `ProposalCreationWorkspaceDemo.tsx` still contains hard-coded package names, pricing algorithms, package descriptions, and staff-facing `includedServices` summary bullets. The lead-facing service lineup is catalog-driven, but a future product decision may also move package metadata and pricing configuration into database-backed package management.
- The migration seeds brands that existed when it ran. Confirm that the brand-provisioning flow seeds/clones these core catalog services before relying on this behavior for newly created brands.
- Published proposals use immutable `QuoteRevision` snapshots. Later catalog edits must not mutate already-published proposals; an intentional republish creates a new revision.
- Real-estate classification remains tag-driven. Do not restore a separate Options-table toggle.
- The repository uses Next.js 16. Read the relevant local guide in `node_modules/next/dist/docs/` before using framework APIs or conventions that may have changed.
- A normal `prisma generate` may fail on Windows with `EPERM` if the running dev server has locked `query_engine-windows.dll.node`. Stop the dev server before regenerating if that occurs.
- The Vercel CLI is not installed. Install it with `npm i -g vercel` if the next session needs `vercel env pull`, deployment, or log access.

## Suggested first commands for the next agent

```powershell
git status --short
git log -1 --oneline --decorate
npm run typecheck
npm test
```

Then perform the authenticated `/offers/add-ons` → proposal preview verification described above before starting unrelated work.

# RLS gate-1 consolidated baseline — repeatable full migration replay

Date: 2026-10-21 (America/Chicago)
Worktree: `~/projects/worktrees/swapp-gate1`, branch `crew/rls-gate1`
Head: `e40149cb5f99b2c830b28c4344fb6e503bfec`
Companion file: `jobs/rls/gate1-baseline.sql` (the baseline itself)

## Count note

The job brief says "40 migrations". M3's branch had 40 migration SQL files.
This branch (`crew/rls-gate1` at `e40149c`, after the leads merge) has **41**:
the 40 M3 files plus `20261021120000_pipe_lead_step`. Everything below
replays all **41** files, numbered #1–#41 in `prisma/migrations/` sort order.
A 42nd line in the directory listing is `migration_lock.toml`, not a migration.

## Why this baseline exists

The repo chain's first migration (`20260815190000`) creates 11 tables, the
second wave adds ~16 more, and the remaining ~37 files are ALTER/INSERT deltas
against tables that were created by a consolidated production baseline
(`20260817205118_init`) that was never committed to this repo. A full replay
from an empty database therefore stops at the first delta whose table is
missing. M3 proved the first stop; gate-1 catalogs every stop and stubs
exactly the missing tables so the whole chain replays.

## Repeatable chain

Fresh empty database, then baseline, then files #1–#41 in sort order.
Every step runs with `ON_ERROR_STOP=1`. The baseline is safe to re-run
(IF NOT EXISTS / DO-guarded; re-run verified clean, exit 0, NOTICE skips only).

```bash
createdb swapp_gate1   # or DROP + CREATE for a true fresh replay
psql -X -v ON_ERROR_STOP=1 -f jobs/rls/gate1-baseline.sql
for d in prisma/migrations/20*/; do
  psql -X -v ON_ERROR_STOP=1 -f "$d/migration.sql"
done
```

## Failure catalog (each confirmed by replaying with prior gaps stubbed)

Static scan: every migration's `ALTER TABLE` / `ADD CONSTRAINT` /
`CREATE INDEX ... ON` / `REFERENCES` / `INSERT INTO` / `UPDATE` target was
diffed against every `CREATE TABLE` in the chain. Nine relations are
referenced but never created. Each was then confirmed empirically: fresh DB +
cumulative stubs up to the gap, replay until stop. Ten stages, S0–S9:

| Stage | Stubs applied (cumulative) | Replay stops at | Error |
| --- | --- | --- | --- |
| S0 | none | #14 `..._add_catalog_service_real_estate_specific` | `relation "catalog_services" does not exist` |
| S1 | + catalog_services | #15 `..._add_catalog_service_tag:8` | `relation "contact_tags" does not exist` (FK target) |
| S2 | + contact_tags | #17 `..._catalog_options_and_quote_revisions:124` | `relation "contact_tag_links" does not exist` |
| S3 | + contact_tag_links | #17 `:143` | `relation "contact_tag_automations" does not exist` |
| S4 | + contact_tag_automations | #17 `:201` | `relation "quotes" does not exist` (FK target of quote_revisions) |
| S5 | + quotes | #19 `..._brand_media_folders:29` | `relation "BrandMedia" does not exist` |
| S6 | + BrandMedia | #23 `..._quote_engagement:19` | `relation "Engagement" does not exist` (FK target) |
| S7 | + Engagement | #38 `..._refine_bookkeeping_service_copy:13` | `relation "CatalogService" does not exist` |
| S8 | + "CatalogService" | #40 `..._pipe_deal_fields:12` | `relation "MeetingLead" does not exist` |
| S9 | + MeetingLead (full baseline) | — | ALL 41 FILES PASS |

Notes on individual gaps:

- #09 (`..._quote_publication_snapshot`) is `to_regclass('public.quotes')`-guarded
  and skips on an empty DB; it runs once the baseline provides `quotes`.
- #12 (`..._reconcile_product_lead_tenant_scope`) guards its `MeetingLead`
  reference the same way; it runs once the baseline provides `MeetingLead`.
- #23's `Engagement` FK sits inside a DO block that only checks the
  *constraint* name, not table existence — unguarded in practice.
- #31 creates `brand_discount_quotes` with an FK to `quotes`: covered by the
  same `quotes` stub, no extra stub needed.
- #38's `UPDATE "CatalogService"` (PascalCase) targets a relation that exists
  nowhere — not in `schema.prisma` (whose model maps to `catalog_services`)
  and not in any migration. Almost certainly a casing bug in that migration;
  on a production database holding only `catalog_services` it would fail the
  same way. The baseline carries a minimal 6-column stub for replay only.
- Baseline stubs carry no FOREIGN KEY constraints because the baseline runs
  before file #1 creates `Brand`/`BrandMembership`/etc.; the migrations add
  the FKs the replay needs. The three UNIQUE constraints on
  `contact_tags`/`contact_tag_links`/`contact_tag_automations` ARE in the
  baseline because #17's `ON CONFLICT` clauses require them.
- Stub columns omitted on purpose (later migrations ADD them with plain,
  non-IF-NOT-EXISTS statements): `catalog_services.realEstateSpecific` (#14),
  `catalog_services.tagId` (#15), `quotes.offerCode` (#31),
  `Engagement.agreementManagerStatus` (#29, type also created there),
  six `Engagement.agreementCancellation*` columns (#30/#32).

## Verified result

Scratch container: `postgres:17.5`, image ID
`sha256:aadf2c0696f5ef357aa7a68da995137f0cf17de06ae5e1f17de06ae5c769b302`
(same image as M3). Database `swapp_gate1`; host port `127.0.0.1:54329`
only. The unrelated `uncleinvoice-app-db-1` container on port 5433 was not
touched. Container stopped and removed after checks; scratch-only passwords
lived in mode-0600 `/tmp` files, removed at teardown. `prisma migrate diff`
generated SQL offline only; no `migrate deploy`/`dev`/`db push` was run; no
production database, env file, or remote was touched.

Final verification (fresh empty DB → committed baseline file → files #1–#41,
`ON_ERROR_STOP=1` throughout):

```text
DROP DATABASE
CREATE DATABASE
=== BASELINE ===
CREATE TABLE (x9, plus 10 DO enum blocks)
=== MIGRATIONS ===
ok #1 20260815190000_initial_platform_foundation
ok #2 20260815201000_add_brand_crm_foundation
ok #3 20260815213500_add_integration_asset_governance
ok #4 20260815223000_add_offboarding_export_foundation
ok #5 20260816010000_enforce_crm_row_level_security
ok #6 20260825000000_add_brand_theme_assets
ok #7 20260825000001_add_dark_brand_assets
ok #8 20260825000002_add_sidebar_logo_type
ok #9 20260826000000_add_quote_publication_snapshot
ok #10 20260826120000_add_brand_theme_proposal_colors
ok #11 20260826160000_add_brand_theme_dark_color
ok #12 20260827000000_reconcile_product_lead_tenant_scope
ok #13 20260827180000_add_brand_theme_accent_dark_color
ok #14 20260827200000_add_catalog_service_real_estate_specific
ok #15 20260827210000_add_catalog_service_tag
ok #16 20260827220000_add_catalog_service_tags
ok #17 20260829120000_catalog_options_and_quote_revisions
ok #18 20260830123500_catalog_core_package_services
ok #19 20260901160000_brand_media_folders
ok #20 20260901163000_brand_discounts
ok #21 20260901170000_discount_activation_and_quote_view
ok #22 20260901180000_discount_held_and_presented
ok #23 20260901190000_quote_engagement
ok #24 20260901200000_dashboard_review_offer_goals
ok #25 20260902120000_reconcile_brand_integration
ok #26 20260902140000_agreement_templates
ok #27 20260902150000_add_accent_foreground_color
ok #28 20260903100000_add_quote_send_timestamps
ok #29 20260903110000_add_agreement_manager_lifecycle
ok #30 20260903120000_add_agreement_cancellation_workflow
ok #31 20260903130000_add_offer_identifiers_and_discount_assignments
ok #32 20260903140000_add_agreement_cancellation_tokens
ok #33 20260904160000_email_connections
ok #34 20260904190000_product_kind_fields
ok #35 20260904191000_seed_hourly_catalog_services
ok #36 20260904200000_add_quote_lifecycle_tracking
ok #37 20260905120000_add_proposal_options_templates
ok #38 20260905210000_refine_bookkeeping_service_copy
ok #39 20261019150000_pipe_businesses_can_decide
ok #40 20261019160000_pipe_deal_fields
ok #41 20261021120000_pipe_lead_step
=== RESULT: 41 files applied, exit 0 ===
36 public tables (27 from chain + 9 stubs); all 9 stub tables present
```

Baseline re-run on the populated database: exit 0, nine `relation already
exists, skipping` notices, no changes.

## Still broken / not claimed

- The replay proves the *migration chain* is complete given this baseline. It
  does not prove the baseline equals production: stub tables carry the
  schema.prisma column sets, but production's lost `..._init` baseline may
  differ (extra/missing columns, data). A production-fingerprint diff is
  still an open gate.
- #38's `"CatalogService"` casing bug is worked around, not fixed. No
  application or migration code was changed in this job (docs only, per brief).
- `prisma migrate deploy` / `prisma migrate status` still cannot drive this
  history (no common lineage with production); the chain above is manual
  `psql -f` replay, same as M3's method.
- RLS role/grant rehearsal, restricted-role suite, and the other M3-review
  gates are untouched by this job.

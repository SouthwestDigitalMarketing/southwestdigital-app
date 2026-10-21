# Brand slug rename plan: `bc` and `treb`

**Plan only. The database rename has NOT been done.** This document changes no
database state and grants no authority to run the SQL. No SQL in this file has
been executed. This plan was prepared without connecting to any database.

**Status: NOT READY.** M4 was ACCEPTed, but all five M4 production cutover
gates remain open. Do not run this plan in production until every gate below
is closed, the target and backup are verified, and Tom records an explicit
GO for the change window. See [RLS cutover runbook](rls-and-roles-cutover.md).

This is a data-only update to `"Brand"."slug"`. It does not change brand IDs,
foreign keys, domains, memberships, hostnames, environment variable names, or
the pipe contacts API. The current application compatibility helper maps the
canonical slugs back to legacy `BC` and `TREB` environment-key suffixes in
[`src/lib/brands/slugs.ts`](../../src/lib/brands/slugs.ts). Keep those
environment keys until a separately reviewed configuration change says
otherwise.

The repo schema defines `"Brand"."slug"` as unique. The initial platform
migration also created a case-insensitive unique index on `lower("slug")`.
This plan expects both guards to remain in place.

## Target mapping

| Current DB slug | Expected brand name | New DB slug | Environment key remains |
| --- | --- | --- | --- |
| `bc` | `Bookkeeping Conroe` | `bookkeeping-conroe` | `BC` |
| `treb` | `The Real Estate Bookkeeper` | `real-estate-bookkeeper` | `TREB` |

The names and current slugs are documented inputs, not live database
verification. The preflight queries below must confirm the exact rows and
collision-free target slugs in the approved database. If they do not match,
stop and revise the plan; do not broaden the SQL.

## Preconditions — every item must pass

1. **M4 gates closed with evidence and owner signoff.** Ummon/app owner closes
   the migration baseline, migration DDL strategy, and restricted-role suite
   gates; Tom closes production fingerprint, grant, backup/restore,
   secret-configuration, and rollback/preflight checks and gives the explicit
   GO; Albedo is assigned post-cutover owner credential rotation and secret
   cleanup. The exact gate register is repeated at the end of this plan.
2. **Target fingerprint verified by Tom.** Record provider project, database,
   host, region, port, and schema in the approved change record. Compare with
   the approved target independently; never infer the target from an env file.
3. **Backup and restore path verified.** Take the approved provider backup and
   logical backup, then confirm a restore rehearsal on a separate disposable
   target. Record only protected backup identifiers and timestamps.
4. **Approved execution identity and DDL strategy.** Use the reviewed identity
   from the M4 plan. It must be able to update `"Brand"` without granting
   ordinary runtime elevated rights. Do not assume the M3 `swd_migrator`
   `CREATE` grant is sufficient for DDL on existing objects.
5. **Expected source rows and target availability verified.** Run the
   read-only queries below in the verified database. There must be exactly one
   `bc` row named `Bookkeeping Conroe`, exactly one `treb` row named `The Real
   Estate Bookkeeper`, and no rows using either canonical target slug or any
   case variant of those targets.
6. **Application compatibility is ready.** Confirm the exact candidate
   artifact accepts both old and canonical slugs. The existing helper
   `legacyBrandSlug()` maps both names to legacy env suffixes, so deployment
   still uses `BC` and `TREB` environment settings. Test brand resolution,
   sign-in, membership, and hostname routing in the approved nonproduction
   rehearsal first.
7. **Pause brand-seeding/upsert jobs for the change window.** In particular,
   do not run `scripts/ensure-operating-brands.mjs` between preflight and the
   SQL update: its canonical-slug upsert could create duplicate brand rows
   while the database still has `bc` or `treb`.
8. **Rollback is rehearsed and staffed.** Keep the prior application
   artifact/configuration available, retain the protected backup through the
   observation window, and assign the operator who can run the guarded
   rollback SQL if smoke checks fail.

Any failed, missing, or uncertain precondition is a **STOP**. Do not execute
part of the two-row rename.

## Order of operations

1. Close and record all five M4 gates. Obtain Tom's same-window GO.
2. Verify the target fingerprint, source rows, target-slug absence, domain
   associations, and membership associations using the read-only queries
   below. Record the two source brand IDs in the protected change record;
   they are intentionally not guessed or hard-coded here.
3. Verify and rehearse the approved backup/restore and rollback path. Pause
   canonical brand seed/upsert jobs for the window.
4. Deploy or confirm the candidate code that handles both old and new slugs
   while retaining `BC` and `TREB` env suffixes. Do not change DNS or hostname
   rows as part of this operation.
5. In one reviewed SQL session, run the guarded transaction below. It checks
   both expected source rows, checks both canonical slugs are unused, locks
   `"Brand"` against concurrent writes, updates both rows, and aborts the
   transaction if either update affects anything other than one row.
6. Run the post-update verification queries in the approved window. If any
   check fails, stop application rollout and use the guarded rollback
   transaction below, subject to its own preconditions.
7. Run sign-in, tenant membership, brand-resolution, and hostname smoke checks
   against both brands. Verify integrations still find the legacy `BC`/`TREB`
   environment keys. Observe errors and auth/tenant logs through the window.
8. Resume paused seed/upsert jobs only after confirming them safe against the
   canonical slugs. Record results and backup retention decision.
9. Do not rotate or remove owner credentials as part of this rename plan.
   Albedo's M4 credential-cleanup gate is separate post-approved-cutover work.

## Read-only preflight queries

Run these only after M4 approval, against the independently verified target,
using the approved read-only/operator identity. These are query text for a
future approved window; **they were not run while preparing M5**.

```sql
-- Required source rows and any exact target-slug rows.
SELECT id, slug, name, status, "updatedAt"
FROM "Brand"
WHERE slug IN ('bc', 'treb', 'bookkeeping-conroe', 'real-estate-bookkeeper')
ORDER BY slug, id;

-- Required to return no rows: catches case variants of either target slug.
SELECT id, slug, name
FROM "Brand"
WHERE lower(slug) IN ('bookkeeping-conroe', 'real-estate-bookkeeper')
  AND slug NOT IN ('bc', 'treb')
ORDER BY slug, id;

-- Record domain associations by stable brand ID before the rename.
SELECT b.id AS brand_id, b.slug, b.name,
       d.id AS domain_id, d.hostname, d.purpose, d.status, d."isPrimary"
FROM "Brand" AS b
LEFT JOIN "BrandDomain" AS d ON d."brandId" = b.id
WHERE b.slug IN ('bc', 'treb')
ORDER BY b.slug, d.hostname;

-- Record membership counts by stable brand ID before the rename.
SELECT b.id AS brand_id, b.slug, b.name, count(m.id) AS membership_count
FROM "Brand" AS b
LEFT JOIN "BrandMembership" AS m ON m."brandId" = b.id
WHERE b.slug IN ('bc', 'treb')
GROUP BY b.id, b.slug, b.name
ORDER BY b.slug;
```

Preflight pass means the first query returns exactly two rows with the names
and current slugs in the mapping table; the second returns zero rows; the last
two result sets are captured for comparison after the update. If the first
query shows a canonical target already exists, stop. Do not merge or delete
brands as part of this slug-only plan.

## Exact forward SQL — not run

The transaction has strict source-name and target-absence guards. It updates
only the two `"Brand"` rows and their `"updatedAt"` values. It does not
change related records, brand IDs, or hostnames. Run only after every
precondition passes and the owner-approved change window begins.

```sql
BEGIN;

LOCK TABLE "Brand" IN SHARE ROW EXCLUSIVE MODE;

DO $rename_brand_slugs$
DECLARE
  bc_count integer;
  treb_count integer;
  changed_count integer;
BEGIN
  SELECT count(*) INTO bc_count
  FROM "Brand"
  WHERE slug = 'bc' AND name = 'Bookkeeping Conroe';

  SELECT count(*) INTO treb_count
  FROM "Brand"
  WHERE slug = 'treb' AND name = 'The Real Estate Bookkeeper';

  IF bc_count <> 1 OR treb_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one named source row for each brand; bc=%, treb=%',
      bc_count, treb_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Brand"
    WHERE lower(slug) IN ('bookkeeping-conroe', 'real-estate-bookkeeper')
  ) THEN
    RAISE EXCEPTION 'At least one canonical target slug is already in use';
  END IF;

  UPDATE "Brand"
  SET slug = 'bookkeeping-conroe', "updatedAt" = CURRENT_TIMESTAMP
  WHERE slug = 'bc' AND name = 'Bookkeeping Conroe';
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 1 THEN
    RAISE EXCEPTION 'Expected to update one bc row; updated %', changed_count;
  END IF;

  UPDATE "Brand"
  SET slug = 'real-estate-bookkeeper', "updatedAt" = CURRENT_TIMESTAMP
  WHERE slug = 'treb' AND name = 'The Real Estate Bookkeeper';
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 1 THEN
    RAISE EXCEPTION 'Expected to update one treb row; updated %', changed_count;
  END IF;
END
$rename_brand_slugs$;

COMMIT;
```

If any guard or update fails, PostgreSQL aborts the transaction; issue
`ROLLBACK` in that session and investigate. Do not retry by weakening a guard.

## Verification queries after the update

```sql
-- Must return exactly these two rows, once each.
SELECT id, slug, name, status, "updatedAt"
FROM "Brand"
WHERE slug IN ('bc', 'treb', 'bookkeeping-conroe', 'real-estate-bookkeeper')
ORDER BY slug, id;

-- Must return zero rows: neither old slug remains and no case-insensitive
-- duplicate canonical target exists.
SELECT id, slug, name
FROM "Brand"
WHERE lower(slug) IN ('bc', 'treb', 'bookkeeping-conroe', 'real-estate-bookkeeper')
  AND slug NOT IN ('bookkeeping-conroe', 'real-estate-bookkeeper')
ORDER BY slug, id;

-- Compare with preflight captures: brand IDs, domains, and domain statuses
-- must be unchanged; only Brand.slug and Brand.updatedAt should differ.
SELECT b.id AS brand_id, b.slug, b.name,
       d.id AS domain_id, d.hostname, d.purpose, d.status, d."isPrimary"
FROM "Brand" AS b
LEFT JOIN "BrandDomain" AS d ON d."brandId" = b.id
WHERE b.slug IN ('bookkeeping-conroe', 'real-estate-bookkeeper')
ORDER BY b.slug, d.hostname;

SELECT b.id AS brand_id, b.slug, b.name, count(m.id) AS membership_count
FROM "Brand" AS b
LEFT JOIN "BrandMembership" AS m ON m."brandId" = b.id
WHERE b.slug IN ('bookkeeping-conroe', 'real-estate-bookkeeper')
GROUP BY b.id, b.slug, b.name
ORDER BY b.slug;
```

Expected: two canonical rows with the expected names; zero old-slug rows;
brand IDs, domains, and membership counts match the captured preflight values.
If any result differs, stop rollout and use the rollback decision below.

## Exact rollback SQL — not run

Rollback is allowed only if the two canonical rows are still the expected
brands, both legacy slugs are unused, and the team confirms no new row was
created under either legacy slug. Restore the application to the compatible
artifact/configuration before changing the database back. This reverses only
the two slug values and `updatedAt`; it does not restore unrelated data.

```sql
BEGIN;

LOCK TABLE "Brand" IN SHARE ROW EXCLUSIVE MODE;

DO $rollback_brand_slugs$
DECLARE
  bookkeeping_count integer;
  real_estate_count integer;
  changed_count integer;
BEGIN
  SELECT count(*) INTO bookkeeping_count
  FROM "Brand"
  WHERE slug = 'bookkeeping-conroe' AND name = 'Bookkeeping Conroe';

  SELECT count(*) INTO real_estate_count
  FROM "Brand"
  WHERE slug = 'real-estate-bookkeeper' AND name = 'The Real Estate Bookkeeper';

  IF bookkeeping_count <> 1 OR real_estate_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one named canonical row for each brand; bookkeeping-conroe=%, real-estate-bookkeeper=%',
      bookkeeping_count, real_estate_count;
  END IF;

  IF EXISTS (SELECT 1 FROM "Brand" WHERE lower(slug) IN ('bc', 'treb')) THEN
    RAISE EXCEPTION 'At least one legacy rollback slug is already in use';
  END IF;

  UPDATE "Brand"
  SET slug = 'bc', "updatedAt" = CURRENT_TIMESTAMP
  WHERE slug = 'bookkeeping-conroe' AND name = 'Bookkeeping Conroe';
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 1 THEN
    RAISE EXCEPTION 'Expected to restore one bc row; updated %', changed_count;
  END IF;

  UPDATE "Brand"
  SET slug = 'treb', "updatedAt" = CURRENT_TIMESTAMP
  WHERE slug = 'real-estate-bookkeeper' AND name = 'The Real Estate Bookkeeper';
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 1 THEN
    RAISE EXCEPTION 'Expected to restore one treb row; updated %', changed_count;
  END IF;
END
$rollback_brand_slugs$;

COMMIT;
```

Run verification again with old slugs expected afterward, then confirm the app
still resolves both brands by their original stable IDs. If rollback guards
fail, stop; do not force the old slugs or merge records.

## M4 gates and owners — still open

M4 acceptance accepted the runbook only; it did **not** close the following
production gates. Each stays a hard stop for this plan:

1. **Migration baseline and repeatable chain — Ummon/app owner.** Full
   40-file replay stops after 13 at
   `20260827200000_add_catalog_service_real_estate_specific` because the
   `catalog_services` baseline is missing. Provide or verify a consolidated
   baseline and repeatable full replay.
2. **Migration ownership/DDL strategy — Ummon/app owner.** `swd_migrator` has
   `CREATE` but cannot `ALTER` existing `Contact` because it owns no tables.
   Define and rehearse a least-privilege strategy for existing and new tables.
3. **Restricted-role suite — Ummon/app owner.** The last result was 880/881,
   with one pre-existing pipe contacts contract/test mismatch. Reconcile it as
   a separate task and rerun; do not change the pipe contacts API in this
   branch.
4. **Production target, roles/grants, backup/restore, secrets, preflight,
   rollback, and cutover decision — Tom.** All remain unverified. Tom owns the
   checks and explicit GO/NO-GO after the first three gates close.
5. **Owner credential/password rotation and secret cleanup — Albedo.** This
   is post-cutover work only, after Tom approves cutover.

## Not included

- The database rename has **NOT** been done; no DB was accessed for this plan.
- No SQL was run, no migration was added, and no application source was
  changed.
- No hostname, DNS, environment key, or secret is changed by this plan.
- No M6 work starts until M5 reviewer ACCEPTs this plan.


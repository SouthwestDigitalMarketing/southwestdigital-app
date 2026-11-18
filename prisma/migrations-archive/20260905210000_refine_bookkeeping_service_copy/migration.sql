-- Narrow client-facing bookkeeping claims and remove the misleading
-- "audit-ready" language. Published Quote revisions are intentionally not
-- changed; this updates the catalogue and reusable options templates only.

BEGIN;

UPDATE "CatalogService"
SET
  "name" = 'Monthly QuickBooks Bookkeeping',
  "description" = 'Recurring categorization and reconciliation for the QuickBooks accounts included in your plan, using the information and access available to us.',
  "client_benefit" = 'Recurring categorization and reconciliation for the QuickBooks accounts included in your plan, using the information and access available to us.',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "offer_key" = 'monthly-bookkeeping';

UPDATE "CatalogService"
SET
  "name" = 'Bookkeeping Document Organization',
  "description" = 'We organize the documents you provide as part of the bookkeeping process.',
  "client_benefit" = 'We organize the documents you provide as part of the bookkeeping process.',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "offer_key" = 'document-organization';

UPDATE "ProposalOptionsTemplate" AS template
SET
  "snapshotJson" = jsonb_set(
    template."snapshotJson",
    '{bonuses}',
    (
      SELECT jsonb_agg(
        CASE bonus->>'id'
          WHEN 'monthly-bookkeeping' THEN bonus || jsonb_build_object(
            'name', 'Monthly QuickBooks Bookkeeping',
            'description', 'Recurring categorization and reconciliation for the QuickBooks accounts included in your plan, using the information and access available to us.'
          )
          WHEN 'document-organization' THEN bonus || jsonb_build_object(
            'name', 'Bookkeeping Document Organization',
            'description', 'We organize the documents you provide as part of the bookkeeping process.'
          )
          ELSE bonus
        END
        ORDER BY position
      )
      FROM jsonb_array_elements(template."snapshotJson"->'bonuses') WITH ORDINALITY AS entries(bonus, position)
    ),
    false
  ),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE jsonb_typeof(template."snapshotJson"->'bonuses') = 'array'
  AND template."name" IN (
    'Basic bookkeeping services',
    'Real-estate bookkeeping',
    'Bookkeeping with all add-ons',
    'Client-ready review — Essential bookkeeping',
    'Client-ready review — Visibility & control',
    'Client-ready review — Real estate portfolio',
    'Client-ready review — Compliance & coordination'
  )
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(template."snapshotJson"->'bonuses') AS bonus
    WHERE bonus->>'id' IN ('monthly-bookkeeping', 'document-organization')
  );

COMMIT;

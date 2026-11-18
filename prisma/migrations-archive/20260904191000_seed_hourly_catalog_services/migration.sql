-- Seed initial hourly catalog services for every existing brand so the new
-- consulting/coaching offer builder has something to draw from on day one.
-- Rates are defaults; each brand can edit them per row in Services.
--
-- Additive and idempotent (ON CONFLICT DO UPDATE for the brand+offer_key
-- unique constraint).

BEGIN;

INSERT INTO "catalog_services" (
  "id", "brandId", "code", "name", "description", "card_label", "client_benefit",
  "itemType", "category", "priority", "default_inclusion", "offer_key", "offer_section",
  "default_price", "billing_cadence", "requires_platform_migration",
  "required_target_platform", "applicability_note",
  "active", "realEstateSpecific", "product_kind", "createdAt", "updatedAt"
)
SELECT
  'offer_' || md5(brand."id" || ':' || item.offer_key),
  brand."id",
  item.code,
  item.name,
  item.description,
  item.name,
  item.description,
  'hourly-session',
  'hourly services',
  item.priority,
  'included',
  item.offer_key,
  'hourly-services',
  item.default_price,
  'one-time',
  false,
  NULL,
  NULL,
  true,
  false,
  item.product_kind,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Brand" AS brand
CROSS JOIN (
  VALUES
    -- Consulting: one-off engagements by the hour or block
    ('consulting-60min',      'HOURLY-CONSULT-60',     '60-minute consulting session', 'One-hour advisory call to review a specific bookkeeping question or setup problem.',                          10, 200.00, 'consulting'),
    ('consulting-half-day',   'HOURLY-CONSULT-HALFD',  'Half-day consulting block',    'Four-hour deep dive for larger cleanup, migration, or setup work.',                                          20, 700.00, 'consulting'),
    -- Coaching: recurring / packaged sessions
    ('coaching-60min',        'HOURLY-COACH-60',       '60-minute coaching session',   'One-hour one-on-one coaching. For business owners running their own books, or bookkeepers building a practice.', 10, 250.00, 'coaching'),
    ('coaching-4-pack',       'HOURLY-COACH-4PACK',    '4-session coaching pack',      'Four weekly coaching sessions. Paid up front; scheduled at the client''s pace.',                             20, 900.00, 'coaching'),
    ('coaching-12-pack',      'HOURLY-COACH-12PACK',   '12-session coaching pack',     'Twelve coaching sessions over one quarter. Paid up front for the full engagement.',                          30, 2400.00, 'coaching')
) AS item(offer_key, code, name, description, priority, default_price, product_kind)
ON CONFLICT ("brandId", "offer_key") DO UPDATE
SET "offer_section" = 'hourly-services',
    "product_kind" = EXCLUDED."product_kind",
    "updatedAt" = CURRENT_TIMESTAMP;

-- Reconciliation:
-- SELECT "brandId", "product_kind", count(*)
-- FROM "catalog_services"
-- WHERE "product_kind" IN ('consulting', 'coaching')
-- GROUP BY "brandId", "product_kind"
-- ORDER BY "brandId", "product_kind";

COMMIT;

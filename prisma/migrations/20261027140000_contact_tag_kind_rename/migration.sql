-- Rename ContactTagKind values to the taxonomy Tom asked for (Kassad):
-- PRODUCT_LEAD -> SERVICES (a service applies to anyone, not just a lead),
-- CLIENT_LEAD -> LEAD (the funnel isn't only for people who'll be clients;
-- training/consulting prospects go through it too). A value rename updates
-- every existing row that used the old value; no row-by-row UPDATE needed.
--
-- Also adds STATUS (active-client / churned / former-client) and
-- REVIEWS_GIVEN (google / video testimonial / pro-advisor), both currently
-- unused until the companion migration below seeds and assigns them.
--
-- Apply with `prisma db execute --file`, per
-- docs/deployment/database-migration-state.md. Run this file in its own
-- execution, BEFORE 20261027141000_contact_tag_kind_status_reviews_data:
-- Postgres will not let a transaction use a brand-new enum value it just
-- added, so the two steps cannot share one `BEGIN`/`COMMIT` or one
-- `prisma db execute` call.

ALTER TYPE "ContactTagKind" RENAME VALUE 'PRODUCT_LEAD' TO 'SERVICES';
ALTER TYPE "ContactTagKind" RENAME VALUE 'CLIENT_LEAD' TO 'LEAD';
ALTER TYPE "ContactTagKind" ADD VALUE IF NOT EXISTS 'STATUS';
ALTER TYPE "ContactTagKind" ADD VALUE IF NOT EXISTS 'REVIEWS_GIVEN';

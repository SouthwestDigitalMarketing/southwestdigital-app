-- One MRR number per client, instead of re-deriving it from tags or deal
-- history each time. Nullable: most contacts are not a recurring client.
-- Additive, no data touched. Apply with `prisma db execute --file`, per
-- docs/deployment/database-migration-state.md.

ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "mrrUsd" DECIMAL(10, 2);

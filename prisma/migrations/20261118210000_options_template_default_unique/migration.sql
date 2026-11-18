-- Replace the partial unique index with the plain form Prisma models.
-- Postgres treats NULLs as distinct in a unique index, so templates with no
-- default (NULL) still never conflict: behaviour is unchanged.
DROP INDEX IF EXISTS "ProposalOptionsTemplate_brandId_defaultForProductKind_key";
CREATE UNIQUE INDEX "ProposalOptionsTemplate_brandId_defaultForProductKind_key"
  ON "ProposalOptionsTemplate"("brandId", "defaultForProductKind");

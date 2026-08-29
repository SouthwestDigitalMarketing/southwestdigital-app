import "server-only";

import { prisma } from "@/lib/prisma";

export type SchemaCapabilities = {
  proposalCatalog: boolean;
  quoteRevisions: boolean;
};

type CapabilityRow = {
  proposalCatalog: boolean;
  quoteRevisions: boolean;
};

export async function getSchemaCapabilities(): Promise<SchemaCapabilities> {
  try {
    const [row] = await prisma.$queryRaw<CapabilityRow[]>`
      SELECT
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'catalog_services'
            AND column_name = 'offer_key'
        ) AS "proposalCatalog",
        to_regclass(current_schema() || '.quote_revisions') IS NOT NULL AS "quoteRevisions"
    `;
    return row ?? { proposalCatalog: false, quoteRevisions: false };
  } catch {
    return { proposalCatalog: false, quoteRevisions: false };
  }
}

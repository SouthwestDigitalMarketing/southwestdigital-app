import "server-only";

import { prisma } from "@/lib/prisma";

export type SchemaCapabilities = {
  proposalCatalog: boolean;
  proposalPackageDefaults: boolean;
  quoteRevisions: boolean;
};

type CapabilityRow = {
  proposalCatalog: boolean;
  proposalPackageDefaults: boolean;
  quoteRevisions: boolean;
};

const NO_CAPABILITIES: SchemaCapabilities = {
  proposalCatalog: false,
  proposalPackageDefaults: false,
  quoteRevisions: false,
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
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'catalog_services'
            AND column_name = 'default_package_keys'
        ) AS "proposalPackageDefaults",
        to_regclass(current_schema() || '.quote_revisions') IS NOT NULL AS "quoteRevisions"
    `;
    return row ?? NO_CAPABILITIES;
  } catch {
    return NO_CAPABILITIES;
  }
}

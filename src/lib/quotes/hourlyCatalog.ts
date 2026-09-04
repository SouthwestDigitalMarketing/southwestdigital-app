import "server-only";

import { prisma } from "@/lib/prisma";
import { isHourlyOfferKind, type OfferKindKey } from "./kinds";

export type HourlyCatalogItem = {
  id: string;
  code: string | null;
  offerKey: string | null;
  name: string;
  description: string | null;
  defaultPrice: number;
  billingCadence: string;
  priority: number;
};

// Load the hourly-service catalog rows for a brand + kind. Only rows where
// product_kind matches the given kind are returned; bookkeeping rows are
// hidden from the hourly builder and vice versa.
export async function loadHourlyCatalog(brandId: string, kind: OfferKindKey): Promise<HourlyCatalogItem[]> {
  if (!isHourlyOfferKind(kind)) return [];
  const rows = await prisma.catalogService.findMany({
    where: { brandId, active: true, productKind: kind },
    orderBy: [{ priority: "asc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      offerKey: true,
      name: true,
      internalDescription: true,
      defaultPrice: true,
      billingCadence: true,
      priority: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    offerKey: row.offerKey,
    name: row.name,
    description: row.internalDescription,
    defaultPrice: row.defaultPrice == null ? 0 : Number(row.defaultPrice),
    billingCadence: row.billingCadence,
    priority: row.priority,
  }));
}

import "server-only";

import { ContactTagKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { REAL_ESTATE_TAG_KEY } from "@/lib/quotes/catalog";

const DEFAULT_CONTACT_TAGS = [
  { key: "bookkeeper", label: "Bookkeeper", kind: ContactTagKind.PRODUCT_LEAD, sortOrder: 10 },
  { key: "business-owner", label: "Business owner", kind: ContactTagKind.CLIENT_LEAD, sortOrder: 20 },
  { key: "accountant", label: "Accountant", kind: ContactTagKind.INDUSTRY, sortOrder: 30 },
  { key: "industry-contact", label: "Industry contact", kind: ContactTagKind.INDUSTRY, sortOrder: 40 },
  { key: "support", label: "Support", kind: ContactTagKind.INDUSTRY, sortOrder: 50 },
  { key: REAL_ESTATE_TAG_KEY, label: "Real estate", kind: ContactTagKind.INDUSTRY, sortOrder: 60 },
];

export async function ensureDefaultContactTags(brandId: string) {
  const existing = await prisma.contactTag.count({ where: { brandId } });
  if (existing === 0) {
    await prisma.contactTag.createMany({
      data: DEFAULT_CONTACT_TAGS.map((tag) => ({
        brandId,
        key: tag.key,
        label: tag.label,
        kind: tag.kind,
        sortOrder: tag.sortOrder,
      })),
      skipDuplicates: true,
    });
    return;
  }

  await prisma.contactTag.upsert({
    where: { brandId_key: { brandId, key: REAL_ESTATE_TAG_KEY } },
    create: {
      brandId,
      key: REAL_ESTATE_TAG_KEY,
      label: "Real estate",
      kind: ContactTagKind.INDUSTRY,
      sortOrder: 60,
    },
    update: {},
  });
}

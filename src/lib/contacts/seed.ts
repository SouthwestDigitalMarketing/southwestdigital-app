import "server-only";

import { ContactTagKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { REAL_ESTATE_TAG_KEY } from "@/lib/quotes/catalog";

const DEFAULT_CONTACT_TAGS = [
  { key: "bookkeeper", label: "Bookkeeper", kind: ContactTagKind.SERVICES, sortOrder: 10 },
  { key: "business-owner", label: "Business owner", kind: ContactTagKind.LEAD, sortOrder: 20 },
  { key: "accountant", label: "Accountant", kind: ContactTagKind.INDUSTRY, sortOrder: 30 },
  { key: "industry-contact", label: "Industry contact", kind: ContactTagKind.INDUSTRY, sortOrder: 40 },
  { key: "support", label: "Support", kind: ContactTagKind.INDUSTRY, sortOrder: 50 },
  { key: REAL_ESTATE_TAG_KEY, label: "Real estate", kind: ContactTagKind.INDUSTRY, sortOrder: 60 },
  { key: "lead", label: "Lead", kind: ContactTagKind.LEAD, sortOrder: 70 },
  { key: "talking", label: "Talking", kind: ContactTagKind.LEAD, sortOrder: 80 },
  { key: "reached", label: "Reached", kind: ContactTagKind.LEAD, sortOrder: 90 },
  { key: "proposed", label: "Proposed", kind: ContactTagKind.LEAD, sortOrder: 100 },
];

// Funnel step tags. MeetingLead.kind is always derivable from held tags:
// an INDUSTRY tag present means PROSPECT, a step tag present means LEAD.
const STEP_TAG_KEYS = ["business-owner", "lead", "talking", "reached", "proposed"];

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

  // Unify funnel step tags to LEAD kind. Tags created by the pipe tool
  // default to CUSTOM, so `lead`/`proposed` rows from before this change get
  // their kind corrected without touching labels. Missing step tags are
  // created; existing labels are never overwritten.
  await prisma.contactTag.updateMany({
    where: { brandId, key: { in: STEP_TAG_KEYS }, kind: { not: ContactTagKind.LEAD } },
    data: { kind: ContactTagKind.LEAD },
  });
  for (const tag of DEFAULT_CONTACT_TAGS) {
    if (!STEP_TAG_KEYS.includes(tag.key)) continue;
    await prisma.contactTag.upsert({
      where: { brandId_key: { brandId, key: tag.key } },
      create: {
        brandId,
        key: tag.key,
        label: tag.label,
        kind: ContactTagKind.LEAD,
        sortOrder: tag.sortOrder,
      },
      update: {},
    });
  }
}

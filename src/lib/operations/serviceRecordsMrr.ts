import "server-only";

import { prisma } from "@/lib/prisma";
import { firmDateKey } from "./schedule";
import { tagDrivenMrr, type ClientMrr, type MrrMismatch, type StartingMrr } from "./serviceRecords";

/**
 * MRR for the dashboard (concepts/service-records-design, Tom's tag rule):
 * clients counted by their `service-<product>-active` tag for a recurring
 * product, fees from their active monthly service records, today in Chicago.
 * Replaces the hand-typed Contact.mrrUsd.
 */
export async function getRecordMrr(
  brandId: string,
  now: Date = new Date(),
): Promise<{ day: string; clients: ClientMrr[]; starting: StartingMrr[]; mismatches: MrrMismatch[] }> {
  const day = firmDateKey(now);
  const [rows, tagged] = await Promise.all([
    prisma.serviceRecord.findMany({
      where: { brandId, basis: "monthly" },
      select: {
        contactId: true,
        product: true,
        basis: true,
        feeAmount: true,
        startDate: true,
        endDate: true,
        contact: { select: { name: true, company: true } },
      },
    }),
    prisma.contact.findMany({
      where: {
        brandId,
        isActive: true,
        tagLinks: { some: { tag: { key: { startsWith: "service-", endsWith: "-active" } } } },
      },
      select: { id: true, name: true, company: true, tagLinks: { select: { tag: { select: { key: true } } } } },
    }),
  ]);
  const records = rows.map((r) => ({
    contactId: r.contactId,
    contactName: r.contact.name,
    company: r.contact.company,
    product: r.product,
    basis: r.basis,
    feeAmount: r.feeAmount === null ? null : Number(r.feeAmount),
    startDate: r.startDate.toISOString().slice(0, 10),
    endDate: r.endDate ? r.endDate.toISOString().slice(0, 10) : null,
  }));
  const result = tagDrivenMrr({
    records,
    tagged: tagged.map((c) => ({ id: c.id, name: c.name, company: c.company, tags: c.tagLinks.map((l) => l.tag.key) })),
    day,
  });
  return { day, ...result };
}

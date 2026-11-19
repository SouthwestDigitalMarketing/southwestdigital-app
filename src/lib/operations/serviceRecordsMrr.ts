import "server-only";

import { prisma } from "@/lib/prisma";
import { firmDateKey } from "./schedule";
import { clientMrrOn, type ClientMrr, type StartingMrr } from "./serviceRecords";

/**
 * MRR from service records (concepts/service-records-design): agreed fees of
 * monthly records active today (firm-local), plus those signed and starting
 * later. Replaces the hand-typed Contact.mrrUsd on the dashboard.
 */
export async function getRecordMrr(
  brandId: string,
  now: Date = new Date(),
): Promise<{ day: string; clients: ClientMrr[]; starting: StartingMrr[] }> {
  const day = firmDateKey(now);
  const rows = await prisma.serviceRecord.findMany({
    where: { brandId, basis: "monthly", OR: [{ endDate: null }, { endDate: { gte: new Date(`${day}T00:00:00Z`) } }] },
    select: {
      contactId: true,
      basis: true,
      feeAmount: true,
      startDate: true,
      endDate: true,
      contact: { select: { name: true, company: true } },
    },
  });
  const records = rows.map((r) => ({
    contactId: r.contactId,
    contactName: r.contact.name,
    company: r.contact.company,
    basis: r.basis,
    feeAmount: r.feeAmount === null ? null : Number(r.feeAmount),
    startDate: r.startDate.toISOString().slice(0, 10),
    endDate: r.endDate ? r.endDate.toISOString().slice(0, 10) : null,
  }));
  return { day, ...clientMrrOn(records, day) };
}

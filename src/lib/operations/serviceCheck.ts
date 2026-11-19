import "server-only";

import { prisma } from "@/lib/prisma";
import { matchArCustomerToContact } from "@/lib/ar/matchArCustomers";
import { PIPE_PROSPECTS_KEY } from "@/lib/pipe/deals";
import { firmDateKey } from "./schedule";
import { markOpenDealsWon } from "./deals";
import { billingMismatches, isActiveOn, type CheckItem } from "./serviceRecords";
import { getRecordMrr } from "./serviceRecordsMrr";
import { syncServiceTags } from "./serviceTags";

const day = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null);

/**
 * Daily service-records check (concepts/service-records-design § Mismatch
 * check). `billing` is this month's Sales by Customer from Bookkeeping
 * Conroe's QuickBooks (read on ripley with `qb`). With `fix`, agents' fixes
 * run first: tags re-derived from records, and a client with a record that
 * is still an open lead has its deals moved to won. What is left is a list
 * with an owner each; only real gaps (no agreement on file) are Tom's.
 */
export async function runServiceCheck(input: {
  brandId: string;
  month: string;
  billing: { customer: string; amount: number }[];
  fix: boolean;
  now?: Date;
}): Promise<CheckItem[]> {
  const asOf = firmDateKey(input.now ?? new Date());
  const brand = await prisma.brand.findUniqueOrThrow({ where: { id: input.brandId }, select: { slug: true } });
  const items: CheckItem[] = [];

  if (input.fix) {
    for (const change of await syncServiceTags(input.brandId)) {
      items.push({
        kind: "tags-synced",
        owner: "agent",
        contactId: change.contactId,
        name: change.name,
        detail: `Tags +${change.add.join(" +") || "-"} -${change.remove.join(" -") || "-"}`,
        fixed: true,
      });
    }
  }

  const rows = await prisma.serviceRecord.findMany({
    where: { brandId: input.brandId },
    select: {
      contactId: true,
      product: true,
      basis: true,
      feeAmount: true,
      startDate: true,
      endDate: true,
      contact: { select: { name: true } },
    },
  });
  const records = rows.map((r) => ({
    contactId: r.contactId,
    contactName: r.contact.name,
    product: r.product,
    basis: r.basis,
    feeAmount: r.feeAmount === null ? null : Number(r.feeAmount),
    startDate: day(r.startDate)!,
    endDate: day(r.endDate),
  }));

  // QuickBooks customers to contacts, the same matcher as past-due amounts.
  const contacts = await prisma.contact.findMany({
    where: { brandId: input.brandId, isActive: true },
    select: { id: true, name: true, company: true },
  });
  const billing = input.billing.map((row) => ({ ...row, contactId: matchArCustomerToContact(row.customer, contacts) }));
  items.push(...billingMismatches({ month: input.month, asOf, billing, records }));

  // Clients (a record active or starting) still sitting as open leads.
  const clientIds = [...new Set(records.filter((r) => isActiveOn(r, asOf) || r.startDate > asOf).map((r) => r.contactId))];
  const deals = await prisma.pipelineItem.findMany({
    where: {
      isActive: true,
      pipeline: { brandId: input.brandId, key: PIPE_PROSPECTS_KEY },
      lead: { contacts: { some: { contactId: { in: clientIds.length ? clientIds : ["-"] } } } },
    },
    select: { id: true, stage: { select: { key: true } }, lead: { select: { contacts: { select: { contactId: true } } } } },
  });
  const leadTagged = new Set(
    (
      await prisma.contactTagLink.findMany({
        where: { contactId: { in: clientIds.length ? clientIds : ["-"] }, tag: { key: "lead" } },
        select: { contactId: true },
      })
    ).map((l) => l.contactId),
  );
  const nameOf = new Map(records.map((r) => [r.contactId, r.contactName]));
  const actorUserId = process.env.PIPE_API_ACTOR_USER_ID?.trim() ?? "";
  for (const contactId of clientIds) {
    const mine = deals.filter((d) => d.lead.contacts.some((c) => c.contactId === contactId));
    const open = mine.filter((d) => d.stage.key !== "won" && d.stage.key !== "lost").length;
    const won = mine.filter((d) => d.stage.key === "won").length;
    if (open || leadTagged.has(contactId)) {
      let fixed = false;
      if (input.fix && actorUserId) {
        await markOpenDealsWon({ brandId: input.brandId, brandSlug: brand.slug, contactId, actorUserId, paidAt: null, signedAt: null });
        fixed = true;
      }
      items.push({
        kind: "open-lead",
        owner: "agent",
        contactId,
        name: nameOf.get(contactId) ?? contactId,
        detail: `Has a service record but ${open} open deal${open === 1 ? "" : "s"}${leadTagged.has(contactId) ? " and the lead tag" : ""}${fixed ? "; moved to won" : ""}`,
        fixed,
      });
    }
    if (won > 1) {
      items.push({
        kind: "duplicate-won",
        owner: "kassad",
        contactId,
        name: nameOf.get(contactId) ?? contactId,
        detail: `${won} won deals for one client`,
      });
    }
  }

  // Tags and records that still disagree after the sync.
  for (const m of (await getRecordMrr(input.brandId, input.now)).mismatches) {
    const handTag = m.problem.startsWith("Recurring service tag");
    items.push({ kind: handTag ? "tag-no-record" : "record-no-tag", owner: handTag ? "tom" : "agent", contactId: m.id, name: m.name, detail: m.problem });
  }
  return items;
}

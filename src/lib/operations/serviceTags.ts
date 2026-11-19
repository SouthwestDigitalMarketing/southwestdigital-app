import "server-only";

import { prisma } from "@/lib/prisma";
import { applyPipeTag } from "@/lib/pipe/tags";
import { firmDateKey } from "./schedule";
import { serviceTagPlan } from "./serviceRecords";

export type ServiceTagChange = { contactId: string; name: string; add: string[]; remove: string[] };

const day = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null);

/**
 * Sets each contact's service and client tags from its service records
 * (concepts/client-lifecycle-tags: the record sets the tag, the tag decides
 * who counts). Runs after a record is saved and nightly, because records
 * start and end on dates. None of these tags has a pipeline automation, but
 * adds still go through applyPipeTag so any future one runs in one place.
 */
export async function syncServiceTags(
  brandId: string,
  options: { contactIds?: string[]; dryRun?: boolean; now?: Date } = {},
): Promise<ServiceTagChange[]> {
  const today = firmDateKey(options.now ?? new Date());
  const brand = await prisma.brand.findUniqueOrThrow({ where: { id: brandId }, select: { slug: true } });
  const records = await prisma.serviceRecord.findMany({
    where: { brandId, ...(options.contactIds ? { contactId: { in: options.contactIds } } : {}) },
    select: { contactId: true, product: true, startDate: true, endDate: true },
  });
  const contactIds = [...new Set(records.map((r) => r.contactId))];
  if (!contactIds.length) return [];
  const contacts = await prisma.contact.findMany({
    where: { id: { in: contactIds }, brandId },
    select: { id: true, name: true, tagLinks: { select: { tag: { select: { key: true } } } } },
  });

  const actorUserId = process.env.PIPE_API_ACTOR_USER_ID?.trim() ?? "";
  if (!options.dryRun && !actorUserId) throw new Error("PIPE_API_ACTOR_USER_ID is not set");
  const changes: ServiceTagChange[] = [];
  for (const contact of contacts) {
    const mine = records
      .filter((r) => r.contactId === contact.id)
      .map((r) => ({ product: r.product, startDate: day(r.startDate)!, endDate: day(r.endDate) }));
    const plan = serviceTagPlan(mine, contact.tagLinks.map((l) => l.tag.key), today);
    if (!plan.add.length && !plan.remove.length) continue;
    changes.push({ contactId: contact.id, name: contact.name, ...plan });
    if (options.dryRun) continue;
    for (const tag of plan.remove) {
      await applyPipeTag({ actorUserId, input: { brand: brand.slug, contactId: contact.id, tag, action: "remove" } });
    }
    for (const tag of plan.add) {
      await applyPipeTag({ actorUserId, input: { brand: brand.slug, contactId: contact.id, tag, action: "add" } });
    }
  }
  return changes;
}

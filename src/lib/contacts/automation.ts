import "server-only";

import { ContactTagKind, LeadKind } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import {
  createBrandDataContext,
  withBrandDataTransaction,
} from "@/lib/tenancy/context";
import { recordSalesEvidence } from "@/lib/automation/evidence";

function leadKindForTag(kind: ContactTagKind): LeadKind {
  return kind === ContactTagKind.INDUSTRY ? LeadKind.PROSPECT : LeadKind.LEAD;
}

// Funnel step tags. MeetingLead.kind is always derivable from the tags a
// contact holds: an INDUSTRY tag present means PROSPECT, a step tag present
// means LEAD. INDUSTRY wins when both are held. Null means no signal, so the
// lead keeps whatever kind it already has.
const STEP_TAG_KEYS: ReadonlySet<string> = new Set([
  "business-owner",
  "lead",
  "talking",
  "reached",
  "proposed",
]);

export function leadKindForHeldTags(tags: { key: string; kind: ContactTagKind }[]): LeadKind | null {
  if (tags.some((tag) => tag.kind === ContactTagKind.INDUSTRY)) return LeadKind.PROSPECT;
  if (tags.some((tag) => STEP_TAG_KEYS.has(tag.key))) return LeadKind.LEAD;
  return null;
}

async function recomputeLeadKindFromHeldTags(
  transaction: Prisma.TransactionClient,
  brandId: string,
  contactId: string,
) {
  const links =
    (await transaction.contactTagLink.findMany({
      where: { contactId },
      select: { tag: { select: { key: true, kind: true } } },
    })) ?? [];
  const held = links.map((link) => link?.tag).filter((tag) => tag !== null && tag !== undefined);
  const kind = leadKindForHeldTags(held);
  if (!kind) return;
  const leadLinks = await transaction.leadContact.findMany({
    where: { brandId, contactId },
    select: { leadId: true },
  });
  if (leadLinks.length === 0) return;
  await transaction.meetingLead.updateMany({
    where: { brandId, id: { in: leadLinks.map((link) => link.leadId) } },
    data: { kind },
  });
}

type TagEvidenceArgs = {
  brandId: string;
  contactId: string;
  contactName: string;
  tagId: string;
  tagLabel: string;
  leadId: string | null;
  action: "assigned" | "removed";
  detail: string;
};

/**
 * Same-transaction audit row for every tag add/remove, mirroring the legacy
 * SQLite `scan_tag_audit` triggers: the evidence event and its All Thing job
 * commit or roll back with the seat change itself.
 */
function recordTagEvidence(transaction: Prisma.TransactionClient, args: TagEvidenceArgs) {
  const eventType = args.action === "assigned" ? "contact.tag_assigned" : "contact.tag_removed";
  const verb = args.action === "assigned" ? "assigned to" : "removed from";
  return recordSalesEvidence(transaction, {
    brandId: args.brandId,
    leadId: args.leadId ?? undefined,
    source: "swapp",
    sourceEventId: `contact-tag:${args.contactId}:${args.tagId}:${args.action}`,
    eventType,
    occurredAt: new Date(),
    summary: `Tag “${args.tagLabel}” ${verb} ${args.contactName}.${args.detail ? ` ${args.detail}` : ""}`,
    sourceRef: `/contacts/${args.contactId}`,
  });
}

export async function applyTagPipelineAutomation(args: {
  brandId: string;
  actorUserId: string;
  contactId: string;
  tagId: string;
}) {
  const context = createBrandDataContext({
    brandId: args.brandId,
    actorUserId: args.actorUserId,
  });
  return withBrandDataTransaction(context, async (transaction) => {
    const tag = await transaction.contactTag.findUnique({
      where: { id: args.tagId },
      select: { kind: true, label: true },
    });
    if (!tag) return;

    const contact = await transaction.contact.findFirst({
      where: { id: args.contactId, brandId: args.brandId },
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
        leadLinks: { select: { leadId: true } },
      },
    });
    if (!contact) return;

    const automation = await transaction.contactTagAutomation.findFirst({
      where: {
        brandId: args.brandId,
        tagId: args.tagId,
        isActive: true,
      },
      include: {
        pipeline: {
          select: {
            id: true,
            key: true,
            isActive: true,
            stages: {
              where: { isActive: true },
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              select: { id: true },
            },
          },
        },
      },
    });

    let leadId = contact.leadLinks[0]?.leadId ?? null;
    let detail = "No pipeline mapping for this tag.";

    if (automation && automation.pipeline.isActive) {
      const stageId = automation.pipeline.stages.some((stage) => stage.id === automation.stageId)
        ? automation.stageId
        : automation.pipeline.stages[0]?.id ?? null;
      if (!stageId) {
        detail = "Mapped pipeline has no active stage.";
      } else {
        if (!leadId) {
          const lead = await transaction.meetingLead.create({
            data: {
              brandId: args.brandId,
              name: contact.name,
              company: contact.company,
              email: contact.email,
              kind: leadKindForTag(tag.kind),
              isActive: true,
            },
            select: { id: true },
          });
          leadId = lead.id;
          await transaction.leadContact.create({
            data: { brandId: args.brandId, leadId, contactId: contact.id },
          });
        }

        const existing = await transaction.pipelineItem.findUnique({
          where: {
            pipelineId_leadId: { pipelineId: automation.pipelineId, leadId },
          },
          select: { id: true },
        });
        if (existing) {
          detail = `Already seated in ${automation.pipeline.key}.`;
        } else {
          await transaction.pipelineItem.create({
            data: {
              pipelineId: automation.pipelineId,
              stageId,
              leadId,
              isActive: true,
            },
          });
          detail = `Seated in ${automation.pipeline.key}.`;
        }
      }
    }

    await recomputeLeadKindFromHeldTags(transaction, args.brandId, contact.id);

    await recordTagEvidence(transaction, {
      brandId: args.brandId,
      contactId: contact.id,
      contactName: contact.name,
      tagId: args.tagId,
      tagLabel: tag.label,
      leadId,
      action: "assigned",
      detail,
    });
  });
}

/**
 * Mirror of the add path: removing a mapped tag unseats the contact's leads
 * from that tag's pipeline, unless another still-held tag maps to the same
 * pipeline. The link delete, the unseat, and the audit row commit together.
 * Nothing else is archived or deleted.
 */
export async function removeTagPipelineAutomation(args: {
  brandId: string;
  actorUserId: string;
  contactId: string;
  tagId: string;
}) {
  const context = createBrandDataContext({
    brandId: args.brandId,
    actorUserId: args.actorUserId,
  });
  return withBrandDataTransaction(context, async (transaction) => {
    const tag = await transaction.contactTag.findUnique({
      where: { id: args.tagId },
      select: { label: true },
    });

    const removed = await transaction.contactTagLink.deleteMany({
      where: { contactId: args.contactId, tagId: args.tagId },
    });
    if (removed.count === 0 || !tag) return { removed: false };

    const contact = await transaction.contact.findFirst({
      where: { id: args.contactId, brandId: args.brandId },
      select: { id: true, name: true },
    });

    let leadId: string | null = null;
    let detail = "No pipeline mapping for this tag.";

    const automation = await transaction.contactTagAutomation.findFirst({
      where: { brandId: args.brandId, tagId: args.tagId, isActive: true },
      include: { pipeline: { select: { id: true, key: true } } },
    });

    if (automation && contact) {
      const remaining = await transaction.contactTagLink.findMany({
        where: { contactId: args.contactId },
        select: { tagId: true },
      });
      const remainingTagIds = remaining.map((link) => link.tagId);
      const sibling =
        remainingTagIds.length > 0
          ? await transaction.contactTagAutomation.findFirst({
              where: {
                brandId: args.brandId,
                tagId: { in: remainingTagIds },
                pipelineId: automation.pipelineId,
                isActive: true,
              },
              select: { id: true },
            })
          : null;

      if (sibling) {
        detail = `Kept seat in ${automation.pipeline.key}: another held tag maps there.`;
      } else {
        const leadLinks = await transaction.leadContact.findMany({
          where: { brandId: args.brandId, contactId: args.contactId },
          select: { leadId: true },
        });
        leadId = leadLinks[0]?.leadId ?? null;
        if (leadLinks.length > 0) {
          await transaction.pipelineItem.deleteMany({
            where: {
              pipelineId: automation.pipelineId,
              leadId: { in: leadLinks.map((link) => link.leadId) },
            },
          });
        }
        detail = `Unseated from ${automation.pipeline.key}.`;
      }
    }

    if (contact) {
      await recomputeLeadKindFromHeldTags(transaction, args.brandId, contact.id);
      await recordTagEvidence(transaction, {
        brandId: args.brandId,
        contactId: contact.id,
        contactName: contact.name,
        tagId: args.tagId,
        tagLabel: tag.label,
        leadId,
        action: "removed",
        detail,
      });
    }

    return { removed: true };
  });
}

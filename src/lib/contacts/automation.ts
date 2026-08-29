import "server-only";

import { ContactTagKind, LeadKind } from "@prisma/client";
import {
  createBrandDataContext,
  withBrandDataTransaction,
} from "@/lib/tenancy/context";

function leadKindForTag(kind: ContactTagKind): LeadKind {
  return kind === ContactTagKind.INDUSTRY ? LeadKind.PROSPECT : LeadKind.LEAD;
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
    const automation = await transaction.contactTagAutomation.findFirst({
      where: {
        brandId: args.brandId,
        tagId: args.tagId,
        isActive: true,
      },
      include: {
        tag: { select: { kind: true } },
        pipeline: {
          select: {
            id: true,
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

    if (!automation || !automation.pipeline.isActive) return;

    const stageId = automation.pipeline.stages.some((stage) => stage.id === automation.stageId)
      ? automation.stageId
      : automation.pipeline.stages[0]?.id ?? null;
    if (!stageId) return;

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

    let leadId = contact.leadLinks[0]?.leadId ?? null;
    if (!leadId) {
      const lead = await transaction.meetingLead.create({
        data: {
          brandId: args.brandId,
          name: contact.name,
          company: contact.company,
          email: contact.email,
          kind: leadKindForTag(automation.tag.kind),
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
    if (existing) return;

    await transaction.pipelineItem.create({
      data: {
        pipelineId: automation.pipelineId,
        stageId,
        leadId,
        isActive: true,
      },
    });
  });
}

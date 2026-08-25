import "server-only";

import { ContactTagKind, LeadKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function leadKindForTag(kind: ContactTagKind): LeadKind {
  return kind === ContactTagKind.INDUSTRY ? LeadKind.PROSPECT : LeadKind.LEAD;
}

export async function applyTagPipelineAutomation(args: {
  brandId: string;
  contactId: string;
  tagId: string;
}) {
  const automation = await prisma.contactTagAutomation.findFirst({
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
            take: 1,
          },
        },
      },
    },
  });

  if (!automation || !automation.pipeline.isActive) return;

  const stageId =
    automation.stageId ?? automation.pipeline.stages[0]?.id ?? null;
  if (!stageId) return;

  const contact = await prisma.contact.findFirst({
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
    const lead = await prisma.meetingLead.create({
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
    await prisma.leadContact.create({
      data: { leadId, contactId: contact.id },
    });
  }

  const existing = await prisma.pipelineItem.findUnique({
    where: { pipelineId_leadId: { pipelineId: automation.pipelineId, leadId } },
    select: { id: true },
  });
  if (existing) return;

  await prisma.pipelineItem.create({
    data: {
      pipelineId: automation.pipelineId,
      stageId,
      leadId,
      isActive: true,
    },
  });
}

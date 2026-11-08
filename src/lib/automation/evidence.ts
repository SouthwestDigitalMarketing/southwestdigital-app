import { Prisma } from "@prisma/client";

export type EvidenceInput = {
  brandId: string;
  leadId?: string;
  source: string;
  sourceEventId: string;
  eventType: string;
  occurredAt: Date;
  summary: string;
  sourceRef?: string;
};

/** Record the evidence and its All Thing work in the same database transaction. */
export async function recordSalesEvidence(tx: Prisma.TransactionClient, input: EvidenceInput) {
  const event = await tx.salesEvidenceEvent.upsert({
    where: { brandId_source_sourceEventId: {
      brandId: input.brandId, source: input.source, sourceEventId: input.sourceEventId,
    } },
    update: {},
    create: {
      brandId: input.brandId,
      leadId: input.leadId ?? null,
      source: input.source,
      sourceEventId: input.sourceEventId,
      eventType: input.eventType,
      occurredAt: input.occurredAt,
      summary: input.summary,
      sourceRef: input.sourceRef ?? null,
    },
    select: { id: true },
  });
  await tx.allThingWriteJob.upsert({
    where: { eventId: event.id },
    update: {},
    create: { eventId: event.id },
  });
  return event.id;
}

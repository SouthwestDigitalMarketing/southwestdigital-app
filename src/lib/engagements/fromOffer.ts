import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { extractOfferEngagementFields } from "./offerFields";

export { extractOfferEngagementFields, offerHasCleanup } from "./offerFields";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function ensureQuoteEngagement(input: {
  brandId: string;
  quoteId: string;
  snapshot: { contactInfo?: unknown; assessment?: unknown };
}) {
  const fields = extractOfferEngagementFields(input.snapshot);
  const quote = await prisma.quote.findFirst({
    where: { id: input.quoteId, brandId: input.brandId },
    select: { id: true, engagementId: true },
  });
  if (!quote) throw new Error("Offer not found.");

  const proposalBuilderState = {
    assessment: input.snapshot.assessment ?? null,
    contactInfo: input.snapshot.contactInfo ?? null,
    hasCleanup: fields.hasCleanup,
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  if (quote.engagementId) {
    const existing = await prisma.engagement.findFirst({
      where: { id: quote.engagementId, brandId: input.brandId },
      select: { id: true, onboardingData: true },
    });
    if (existing) {
      const onboardingData = isRecord(existing.onboardingData) ? existing.onboardingData : {};
      const previousState = isRecord(onboardingData.proposalBuilderState)
        ? onboardingData.proposalBuilderState
        : {};
      await prisma.engagement.update({
        where: { id: existing.id },
        data: {
          clientName: fields.clientName,
          clientLegalName: fields.clientLegalName,
          primaryContactName: fields.primaryContactName,
          primaryContactEmail: fields.primaryContactEmail,
          primaryContactPhone: fields.primaryContactPhone,
          billingContactEmail: fields.billingContactEmail,
          onboardingData: {
            ...onboardingData,
            proposalBuilderState: {
              ...previousState,
              ...proposalBuilderState,
              services: isRecord(previousState.services) ? previousState.services : undefined,
            },
          } as Prisma.InputJsonValue,
        },
      });
      return existing.id;
    }
  }

  const created = await prisma.engagement.create({
    data: {
      brandId: input.brandId,
      clientName: fields.clientName,
      clientLegalName: fields.clientLegalName,
      primaryContactName: fields.primaryContactName,
      primaryContactEmail: fields.primaryContactEmail,
      primaryContactPhone: fields.primaryContactPhone,
      billingContactEmail: fields.billingContactEmail,
      status: "SENT_TO_CLIENT",
      onboardingData: { proposalBuilderState } as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  await prisma.quote.update({
    where: { id: quote.id },
    data: { engagementId: created.id },
  });

  return created.id;
}

export async function markEngagementDepositPaid(engagementId: string, brandId?: string) {
  await prisma.engagement.updateMany({
    where: brandId ? { id: engagementId, brandId } : { id: engagementId },
    data: { onboardingFeeStatus: "PAID", status: "DEPOSIT_PAID" },
  });
}

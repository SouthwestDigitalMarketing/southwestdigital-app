import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { asRecord } from "@/lib/engagements/acceptedPayment";

const PROCESSED_EVENT_ID_CAP = 32;

export function readProcessedStripeEventIds(onboardingData: unknown): string[] {
  const acceptance = asRecord(asRecord(onboardingData).proposalAcceptance);
  const ids = acceptance.processedStripeEventIds;
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is string => typeof id === "string" && id.length > 0);
}

function requireEventIdentity(engagementId: string, brandId: string, eventId: string) {
  if (!engagementId || !brandId || !eventId) throw new Error("Payment identity is required.");
}

export async function stripeEventAlreadyProcessed(
  engagementId: string,
  brandId: string,
  eventId: string,
): Promise<boolean> {
  requireEventIdentity(engagementId, brandId, eventId);
  const engagement = await prisma.engagement.findFirst({
    where: { id: engagementId, brandId },
    select: { onboardingData: true },
  });
  if (!engagement) return false;
  return readProcessedStripeEventIds(engagement.onboardingData).includes(eventId);
}

export async function recordProcessedStripeEvent(
  engagementId: string,
  brandId: string,
  eventId: string,
): Promise<void> {
  requireEventIdentity(engagementId, brandId, eventId);
  await prisma.$transaction(async (tx) => {
    const engagement = await tx.engagement.findFirst({
      where: { id: engagementId, brandId },
      select: { onboardingData: true, updatedAt: true },
    });
    if (!engagement) throw new Error("Engagement not found.");
    const ids = readProcessedStripeEventIds(engagement.onboardingData);
    if (ids.includes(eventId)) return;
    const onboardingData = asRecord(engagement.onboardingData);
    const acceptance = asRecord(onboardingData.proposalAcceptance);
    const updated = await tx.engagement.updateMany({
      where: { id: engagementId, brandId, updatedAt: engagement.updatedAt },
      data: {
        onboardingData: {
          ...onboardingData,
          proposalAcceptance: {
            ...acceptance,
            processedStripeEventIds: [...ids, eventId].slice(-PROCESSED_EVENT_ID_CAP),
          },
        } as Prisma.InputJsonValue,
      },
    });
    if (updated.count !== 1) throw new Error("Payment state changed concurrently; retry reconciliation.");
  });
}

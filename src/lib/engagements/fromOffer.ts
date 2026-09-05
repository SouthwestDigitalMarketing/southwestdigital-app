import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readAcceptedPayment } from "./acceptedPayment";
import { extractOfferEngagementFields } from "./offerFields";

export { extractOfferEngagementFields, offerHasCleanup } from "./offerFields";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// Only these Quote.kind values correspond to engagement-producing product
// flows. Anything else falls back to bookkeeping so existing behavior is
// preserved.
function resolveProductKind(kind: string | null | undefined): string {
  if (kind === "consulting" || kind === "coaching") return kind;
  return "bookkeeping";
}

export async function ensureQuoteEngagement(input: {
  brandId: string;
  quoteId: string;
  snapshot: { contactInfo?: unknown; assessment?: unknown; isTestProposal?: unknown };
}, transaction?: Prisma.TransactionClient) {
  const database = transaction ?? prisma;
  const fields = extractOfferEngagementFields(input.snapshot);
  const quote = await database.quote.findFirst({
    where: { id: input.quoteId, brandId: input.brandId },
    select: { id: true, engagementId: true, kind: true },
  });
  if (!quote) throw new Error("Offer not found.");
  const productKind = resolveProductKind(quote.kind);

  const proposalBuilderState = {
    assessment: input.snapshot.assessment ?? null,
    contactInfo: input.snapshot.contactInfo ?? null,
    hasCleanup: fields.hasCleanup,
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  if (quote.engagementId) {
    const existing = await database.engagement.findFirst({
      where: { id: quote.engagementId, brandId: input.brandId },
      select: { id: true, onboardingData: true, signedAt: true, updatedAt: true },
    });
    if (existing) {
      if (existing.signedAt) return existing.id;
      const onboardingData = isRecord(existing.onboardingData) ? existing.onboardingData : {};
      const previousState = isRecord(onboardingData.proposalBuilderState)
        ? onboardingData.proposalBuilderState
        : {};
      const updated = await database.engagement.updateMany({
        where: { id: existing.id, brandId: input.brandId, signedAt: null, updatedAt: existing.updatedAt },
        data: {
          clientName: fields.clientName,
          clientLegalName: fields.clientLegalName,
          primaryContactName: fields.primaryContactName,
          primaryContactEmail: fields.primaryContactEmail,
          primaryContactPhone: fields.primaryContactPhone,
          billingContactEmail: fields.billingContactEmail,
          productKind,
          isTestProposal: input.snapshot.isTestProposal === true,
          ...(existing.signedAt
            ? {}
            : { agreementText: null, agreementTextHash: null }),
          onboardingData: {
            ...onboardingData,
            proposalBuilderState: {
              ...previousState,
              ...proposalBuilderState,
              services: null,
            },
          } as Prisma.InputJsonValue,
        },
      });
      if (updated.count !== 1) throw new Error("The agreement changed during publishing. Reload before continuing.");
      return existing.id;
    }
  }

  const created = await database.engagement.create({
    data: {
      brandId: input.brandId,
      clientName: fields.clientName,
      clientLegalName: fields.clientLegalName,
      primaryContactName: fields.primaryContactName,
      primaryContactEmail: fields.primaryContactEmail,
      primaryContactPhone: fields.primaryContactPhone,
      billingContactEmail: fields.billingContactEmail,
      productKind,
      isTestProposal: input.snapshot.isTestProposal === true,
      status: "SENT_TO_CLIENT",
      onboardingData: { proposalBuilderState } as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  await database.quote.update({
    where: { id: quote.id },
    data: { engagementId: created.id },
  });

  return created.id;
}

export async function markEngagementDepositPaid(
  engagementId: string,
  brandId: string,
  payment: {
    provider: "stripe" | "paypal";
    reference: string;
    amount: number;
    currency: string;
    receiptUrl?: string | null;
  },
) {
  if (!brandId || !payment.reference) throw new Error("Payment identity is required.");
  return prisma.$transaction(async (tx) => {
  const engagement = await tx.engagement.findFirst({
    where: { id: engagementId, brandId },
    select: { id: true, brandId: true, onboardingData: true, updatedAt: true, signedAt: true, onboardingFeeStatus: true },
  });
  if (!engagement?.signedAt) throw new Error("Signed engagement not found.");
  const onboardingData = isRecord(engagement.onboardingData) ? engagement.onboardingData : {};
  const acceptance = isRecord(onboardingData.proposalAcceptance) ? onboardingData.proposalAcceptance : {};
  const obligation = readAcceptedPayment(onboardingData);
  if (!obligation || !Number.isFinite(payment.amount) || payment.amount <= 0 ||
      Math.round(payment.amount * 100) !== obligation.amountInCents ||
      payment.currency.toLowerCase() !== obligation.currency) throw new Error("Payment does not match the signed obligation.");
  const previousPayment = isRecord(acceptance.payment) ? acceptance.payment : {};
  if (previousPayment.status === "paid" || engagement.onboardingFeeStatus === "PAID") {
    if (previousPayment.provider !== payment.provider || previousPayment.reference !== payment.reference ||
        previousPayment.amount !== payment.amount || previousPayment.currency !== payment.currency) {
      throw new Error("A different payment is already recorded; reconciliation is required.");
    }
    return; // Preserve the original evidence and timestamp on retries.
  }
  const paidAt = new Date();
  const updated = await tx.engagement.updateMany({
    where: { id: engagement.id, brandId, updatedAt: engagement.updatedAt },
    data: {
      onboardingFeeStatus: "PAID",
      status: "DEPOSIT_PAID",
      onboardingData: {
        ...onboardingData,
        proposalAcceptance: {
          ...acceptance,
          payment: { ...payment, status: "paid", paidAt: paidAt.toISOString() },
        },
      } as Prisma.InputJsonValue,
    },
  });
  if (updated.count !== 1) throw new Error("Payment state changed concurrently; retry reconciliation.");
  await tx.quote.updateMany({
    where: { engagementId, brandId: engagement.brandId, status: { not: "archived" } },
    data: { status: "completed", lastActivityAt: paidAt },
  });
  });
}

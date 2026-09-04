"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireQuoteStaffOrThrow } from "@/lib/quotes/access";
import { getSchemaCapabilities } from "@/lib/database/schemaCapabilities";
import { ensureQuoteEngagement } from "@/lib/engagements/fromOffer";
import {
  buildHourlyCheckoutSummary,
  parseHourlyCheckoutSelection,
  type HourlyOfferKind,
} from "@/lib/engagements/hourlyCheckout";
import { isHourlyOfferKind } from "@/lib/quotes/kinds";

function asJsonObject(value: unknown): Prisma.InputJsonObject {
  const parsed: unknown = JSON.parse(JSON.stringify(value));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Offer data must be a JSON object.");
  }
  return parsed as Prisma.InputJsonObject;
}

export type HourlyOfferSnapshot = {
  kind: HourlyOfferKind;
  contactInfo: {
    companyName: string;
    invoicingEmail: string;
    primaryContact: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
    };
  };
  selection: {
    catalogItemId: string;
    catalogItemLabel: string;
    quantity: number;
    unitPrice: number;
    intakeFee: number;
  };
  agreementTemplateId: string | null;
  agreementTemplateName: string | null;
  agreementText: string | null;
  isTestProposal: boolean;
};

async function loadOwnedQuote(offerId: string, brandId: string) {
  const quote = await prisma.quote.findFirst({
    where: { id: offerId, brandId },
    select: {
      id: true,
      kind: true,
      status: true,
      publicToken: true,
      snapshotJson: true,
      clientId: true,
      client: { select: { name: true, email: true, company: true } },
    },
  });
  if (!quote) throw new Error("Offer not found.");
  if (!isHourlyOfferKind(quote.kind)) throw new Error("This offer is not an hourly offer.");
  if (quote.status === "archived") throw new Error("This offer is archived.");
  return quote;
}

function normalizedSnapshot(input: HourlyOfferSnapshot, priorSnapshot: unknown) {
  const priorContactInfo =
    priorSnapshot && typeof priorSnapshot === "object" && !Array.isArray(priorSnapshot)
      ? (priorSnapshot as Record<string, unknown>).contactInfo
      : null;
  return {
    kind: input.kind,
    contactInfo: {
      ...(priorContactInfo && typeof priorContactInfo === "object" ? priorContactInfo : {}),
      companyName: input.contactInfo.companyName,
      invoicingEmail: input.contactInfo.invoicingEmail,
      primaryContact: input.contactInfo.primaryContact,
    },
    selection: input.selection,
    agreementTemplateId: input.agreementTemplateId,
    agreementTemplateName: input.agreementTemplateName,
    agreementText: input.agreementText,
    isTestProposal: input.isTestProposal,
  };
}

function validateSelection(input: HourlyOfferSnapshot) {
  const parsed = parseHourlyCheckoutSelection({
    kind: input.kind,
    catalogItemId: input.selection.catalogItemId,
    catalogItemLabel: input.selection.catalogItemLabel,
    quantity: input.selection.quantity,
    unitPrice: input.selection.unitPrice,
    intakeFee: input.selection.intakeFee,
  });
  if (!parsed) throw new Error("Fill in the service, quantity, and rate before saving.");
  return parsed;
}

export async function saveHourlyOfferDraftAction(offerId: string, snapshot: HourlyOfferSnapshot) {
  const { brand } = await requireQuoteStaffOrThrow();
  const existing = await loadOwnedQuote(offerId, brand.id);
  validateSelection(snapshot);
  const merged = normalizedSnapshot(snapshot, existing.snapshotJson);
  const jsonSnapshot = asJsonObject(merged);
  await prisma.quote.update({
    where: { id: existing.id },
    data: { snapshotJson: jsonSnapshot },
  });
  revalidatePath("/offers");
  revalidatePath(`/offers/${existing.id}`);
}

export async function publishHourlyOfferAction(offerId: string, snapshot: HourlyOfferSnapshot) {
  const { brand } = await requireQuoteStaffOrThrow();
  const existing = await loadOwnedQuote(offerId, brand.id);
  const selection = validateSelection(snapshot);
  const summary = buildHourlyCheckoutSummary(selection);

  const merged = normalizedSnapshot(snapshot, existing.snapshotJson);
  const finalSnapshot = asJsonObject({ ...merged, checkoutSummary: summary });

  const publicToken = existing.publicToken ?? randomBytes(32).toString("base64url");
  const publishedAt = new Date();
  const { quoteRevisions, quoteEngagement } = await getSchemaCapabilities();

  await prisma.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id: existing.id },
      data: {
        snapshotJson: finalSnapshot,
        publishedSnapshotJson: finalSnapshot,
        publicToken,
        publishedAt,
        totalOneTime: new Prisma.Decimal(summary.total),
        totalRecurring: new Prisma.Decimal(0),
        onboardingFee: new Prisma.Decimal(summary.intakeFee),
      },
    });
    if (quoteRevisions) {
      const latestRevision = await tx.quoteRevision.findFirst({
        where: { brandId: brand.id, quoteId: existing.id },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const version = (latestRevision?.version ?? 0) + 1;
      await tx.quoteRevision.updateMany({
        where: { brandId: brand.id, quoteId: existing.id, supersededAt: null },
        data: { supersededAt: publishedAt },
      });
      await tx.quoteRevision.create({
        data: {
          brandId: brand.id,
          quoteId: existing.id,
          version,
          snapshotJson: finalSnapshot,
          publishedAt,
        },
      });
    }
  });

  if (quoteEngagement) {
    const engagementId = await ensureQuoteEngagement({
      brandId: brand.id,
      quoteId: existing.id,
      snapshot: {
        contactInfo: merged.contactInfo,
        assessment: {
          hourlyOffer: true,
          checkoutSummary: summary,
          agreementText: merged.agreementText,
        },
        isTestProposal: merged.isTestProposal,
      },
    });
    // Store hourly checkout summary in onboardingData.proposalBuilderState.services
    // so the payment-intent route (dispatched by productKind) can find it via
    // parseStoredHourlyCheckout. Also set engagement.agreementText so the
    // existing sign / signed-PDF pipeline works unchanged.
    const eng = await prisma.engagement.findFirst({
      where: { id: engagementId, brandId: brand.id },
      select: { onboardingData: true, signedAt: true },
    });
    if (eng) {
      const onboardingData = eng.onboardingData && typeof eng.onboardingData === "object" && !Array.isArray(eng.onboardingData)
        ? (eng.onboardingData as Record<string, unknown>)
        : {};
      const builderState = onboardingData.proposalBuilderState && typeof onboardingData.proposalBuilderState === "object" && !Array.isArray(onboardingData.proposalBuilderState)
        ? (onboardingData.proposalBuilderState as Record<string, unknown>)
        : {};
      const priorServices = builderState.services && typeof builderState.services === "object" && !Array.isArray(builderState.services)
        ? (builderState.services as Record<string, unknown>)
        : {};
      const nextData = {
        ...onboardingData,
        proposalBuilderState: {
          ...builderState,
          services: { ...priorServices, hourlyCheckout: summary },
          version: 1,
          updatedAt: new Date().toISOString(),
        },
      };
      await prisma.engagement.update({
        where: { id: engagementId },
        data: {
          onboardingData: nextData as Prisma.InputJsonValue,
          // Only set agreementText if not already signed — mirrors the
          // guard in ensureQuoteEngagement.
          ...(eng.signedAt || !merged.agreementText
            ? {}
            : { agreementText: merged.agreementText }),
        },
      });
    }
  }

  revalidatePath("/offers");
  revalidatePath(`/offers/${existing.id}`);
  revalidatePath(`/proposal/${publicToken}`);
  return { publicPath: `/proposal/${publicToken}` };
}

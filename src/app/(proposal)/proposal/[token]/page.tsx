import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSchemaCapabilities } from "@/lib/database/schemaCapabilities";
import { resolvePublicBrand } from "@/lib/brands/resolve";
import OfferProposalPreview from "@/app/(app)/offers/builder/OfferProposalPreview";
import type { AssessmentState } from "@/app/(app)/offers/builder/ProposalCreationWorkspaceDemo";
import type { ContactInfoState } from "@/app/(app)/offers/builder/ProposalContactInfoState";
import { isLeadConvertedForDiscount, pickActiveCatalogOffer } from "@/lib/discounts/eligibility";
import { ensureQuoteEngagement } from "@/lib/engagements/fromOffer";
import { quoteContactSummaryFromSnapshot } from "@/lib/quotes/clientInfo";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export default async function PublicProposalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const hostname = (await headers()).get("x-hostname");
  const brand = await resolvePublicBrand(hostname);
  if (!brand) notFound();
  const { quoteRevisions, quoteEngagement } = await getSchemaCapabilities();
  const quote = await prisma.quote.findFirst({
    where: { brandId: brand.id, publicToken: token, publishedAt: { not: null } },
    select: {
      id: true,
      publishedSnapshotJson: true,
      publishedAt: true,
      firstViewedAt: true,
      status: true,
      engagementId: true,
    },
  });
  const viewedAt = new Date();
  if (quote && !quote.firstViewedAt) {
    await prisma.quote.updateMany({
      where: { id: quote.id, firstViewedAt: null },
      data: { firstViewedAt: viewedAt },
    });
  }
  const firstViewedAt = quote?.firstViewedAt ?? (quote ? viewedAt : null);
  const revision = quote && quoteRevisions
    ? await prisma.quoteRevision.findFirst({
        where: { brandId: brand.id, quoteId: quote.id },
        orderBy: { version: "desc" },
        select: { snapshotJson: true },
      })
    : null;
  const revisionSnapshot = revision?.snapshotJson;
  const snapshot = isRecord(revisionSnapshot)
    ? revisionSnapshot
    : isRecord(quote?.publishedSnapshotJson)
      ? quote.publishedSnapshotJson
      : null;
  if (!snapshot) notFound();
  const isFreshDuplicate = snapshot.isFreshDuplicate === true;
  const suppressPromotions = isFreshDuplicate || snapshot.suppressPromotions === true;

  let engagementId = quoteEngagement ? quote?.engagementId ?? null : null;
  if (quote && quoteEngagement && !engagementId) {
    try {
      engagementId = await ensureQuoteEngagement({
        brandId: brand.id,
        quoteId: quote.id,
        snapshot: {
          contactInfo: snapshot.contactInfo,
          assessment: snapshot.assessment,
        },
      });
    } catch (error) {
      console.error("[proposal] Could not attach an engagement for signing and payment:", error);
    }
  }

  const primaryContactId = quoteContactSummaryFromSnapshot(snapshot).contactId;
  const [discounts, engagement] = await Promise.all([
    suppressPromotions
      ? Promise.resolve([])
      : prisma.brandDiscount.findMany({
          where: {
            brandId: brand.id,
            active: true,
            OR: [
              { contactId: null },
              ...(primaryContactId ? [{ contactId: primaryContactId }] : []),
            ],
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        }),
    engagementId
      ? prisma.engagement.findFirst({
          where: { id: engagementId, brandId: brand.id },
          select: { status: true },
        })
      : Promise.resolve(null),
  ]);
  const catalogOffer = pickActiveCatalogOffer(
    discounts.map((discount) => ({
      kind: discount.kind,
      percent: discount.percent,
      amount: Number(discount.amount),
      title: discount.title,
      details: discount.details,
      activationMode: discount.activationMode,
      activationDelayDays: discount.activationDelayDays,
      deadlineMode: discount.deadlineMode,
      durationDays: discount.durationDays,
      deadlineDate: discount.deadlineDate,
      presentedAt: discount.presentedAt,
    })),
    {
      publishedAt: quote?.publishedAt ?? null,
      firstViewedAt,
      converted: isLeadConvertedForDiscount({
        quoteStatus: quote?.status,
        engagementStatus: engagement?.status,
      }),
    },
  );

  return (
    <OfferProposalPreview
      initialAssessment={isRecord(snapshot.assessment) ? (snapshot.assessment as Partial<AssessmentState>) : undefined}
      initialContactInfo={isRecord(snapshot.contactInfo) ? (snapshot.contactInfo as Partial<ContactInfoState>) : undefined}
      live
      catalogOffer={catalogOffer}
      engagementId={engagementId}
    />
  );
}

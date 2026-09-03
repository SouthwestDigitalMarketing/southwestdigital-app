import "server-only";
import { prisma } from "@/lib/prisma";
import { quoteContactSummaryFromSnapshot } from "@/lib/quotes/clientInfo";
import { pickActiveCatalogOffer } from "./eligibility";

export async function resolveOnboardingWaiverForEngagement(engagementId: string): Promise<boolean> {
  const quote = await prisma.quote.findFirst({
    where: { engagementId },
    select: {
      brandId: true,
      publishedAt: true,
      firstViewedAt: true,
      publishedSnapshotJson: true,
      snapshotJson: true,
    },
  });
  if (!quote) return false;

  const summary = quoteContactSummaryFromSnapshot(quote.publishedSnapshotJson ?? quote.snapshotJson);
  const primaryContactId = summary.contactId;

  const discounts = await prisma.brandDiscount.findMany({
    where: {
      brandId: quote.brandId,
      active: true,
      OR: [
        { contactId: null },
        ...(primaryContactId ? [{ contactId: primaryContactId }] : []),
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  if (discounts.length === 0) return false;

  const offer = pickActiveCatalogOffer(
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
      publishedAt: quote.publishedAt,
      firstViewedAt: quote.firstViewedAt,
      converted: false,
    },
  );

  return offer?.kind === "onboarding-waiver";
}

import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildProposalCheckoutSummary,
  applyOnboardingWaiver,
  parseProposalCheckoutSelection,
} from "@/lib/engagements/proposalCheckout";
import { resolveOnboardingWaiverForEngagement } from "@/lib/discounts/resolveOnboardingWaiver";
import { hasPublicProposalAccess, publicProposalNotFound } from "@/lib/engagements/publicProposalAccess";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ engagementId: string }> },
) {
  const { engagementId } = await params;
  if (!await hasPublicProposalAccess(request, engagementId)) return publicProposalNotFound();
  const selection = parseProposalCheckoutSelection(await request.json().catch(() => null));
  if (!selection) return NextResponse.json({ error: "Invalid proposal selection" }, { status: 400 });

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: {
      onboardingData: true,
      updatedAt: true,
      brandId: true,
      onboardingFeeStatus: true,
      signedAt: true,
      agreementManagerStatus: true,
      quotes: {
        take: 1,
        select: {
          publishedSnapshotJson: true,
          revisions: {
            take: 1,
            orderBy: { version: "desc" },
            select: { snapshotJson: true },
          },
        },
      },
    },
  });
  if (!engagement) return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
  if (engagement.agreementManagerStatus === "VOIDED" || engagement.agreementManagerStatus === "VOIDED_BEFORE_SIGNATURE" || engagement.agreementManagerStatus === "CANCELLATION_REQUESTED" || engagement.agreementManagerStatus === "TERMINATED_AFTER_SIGNATURE") {
    return NextResponse.json({ error: "This agreement is no longer available for changes." }, { status: 409 });
  }
  if (engagement.signedAt) {
    return NextResponse.json({ error: "A signed proposal selection cannot be changed." }, { status: 409 });
  }
  if (engagement.onboardingFeeStatus === "PAID") {
    return NextResponse.json({ error: "A paid proposal selection cannot be changed." }, { status: 409 });
  }

  const quote = engagement.quotes[0];
  const publishedSnapshot = quote?.revisions[0]?.snapshotJson ?? quote?.publishedSnapshotJson;
  let checkout;
  try {
    checkout = buildProposalCheckoutSummary(publishedSnapshot, selection);
    if (await resolveOnboardingWaiverForEngagement(engagementId)) {
      checkout = applyOnboardingWaiver(checkout);
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Published pricing is invalid." },
      { status: 409 },
    );
  }

  const onboardingData = isRecord(engagement.onboardingData) ? engagement.onboardingData : {};
  const existingState = isRecord(onboardingData.proposalBuilderState) ? onboardingData.proposalBuilderState : {};
  const proposalBuilderState = {
    ...existingState,
    services: {
      ...checkout,
      selectedTier: checkout.tier,
      selectedTierLabel: checkout.tierLabel,
      selectedAt: new Date().toISOString(),
    },
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  const onboardingFeeStatus = checkout.onboardingFee === 0 ? "WAIVED" : "REQUIRED";

  const updated = await prisma.engagement.updateMany({
    where: { id: engagementId, brandId: engagement.brandId, signedAt: null, updatedAt: engagement.updatedAt },
    data: {
      onboardingData: { ...onboardingData, proposalBuilderState } as Prisma.InputJsonValue,
      onboardingFee: checkout.onboardingFee,
      onboardingFeeStatus,
      scopingMode: "AGREEMENT",
      isExpedited: true,
      agreementText: null,
      agreementTextHash: null,
    },
  });
  if (updated.count !== 1) return NextResponse.json({ error: "The proposal changed in another tab. Reload before selecting again." }, { status: 409 });

  return NextResponse.json({ ok: true, checkout });
}

import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isProposalTierId } from "@/lib/engagements/proposalSelection";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ engagementId: string }> },
) {
  const { engagementId } = await params;
  const body = (await request.json().catch(() => null)) as {
    tier?: unknown;
    tierLabel?: unknown;
    onboardingFee?: unknown;
    recurringMonthlyTotal?: unknown;
  } | null;

  const tier = typeof body?.tier === "string" ? body.tier : "";
  if (!isProposalTierId(tier)) return NextResponse.json({ error: "Invalid tier" }, { status: 400 });

  const onboardingFee = typeof body?.onboardingFee === "number" ? body.onboardingFee : null;
  if (onboardingFee === null || onboardingFee < 0) return NextResponse.json({ error: "Invalid onboardingFee" }, { status: 400 });

  const tierLabel = typeof body?.tierLabel === "string" ? body.tierLabel : tier;
  const recurringMonthlyTotal = typeof body?.recurringMonthlyTotal === "number" ? body.recurringMonthlyTotal : null;

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { onboardingData: true, onboardingFeeStatus: true, signedAt: true, agreementManagerStatus: true },
  });
  if (!engagement) return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
  if (engagement.agreementManagerStatus === "VOIDED" || engagement.agreementManagerStatus === "VOIDED_BEFORE_SIGNATURE" || engagement.agreementManagerStatus === "CANCELLATION_REQUESTED" || engagement.agreementManagerStatus === "TERMINATED_AFTER_SIGNATURE") {
    return NextResponse.json({ error: "This agreement is no longer available for changes." }, { status: 409 });
  }

  const onboardingData = isRecord(engagement.onboardingData) ? engagement.onboardingData : {};
  const existingState = isRecord(onboardingData.proposalBuilderState) ? onboardingData.proposalBuilderState : {};
  const proposalBuilderState = {
    ...existingState,
    services: {
      selectedTier: tier,
      selectedTierLabel: tierLabel,
      onboardingFee,
      recurringMonthlyTotal,
      selectedAt: new Date().toISOString(),
    },
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  const onboardingFeeStatus = engagement.onboardingFeeStatus ?? "REQUIRED";

  await prisma.engagement.update({
    where: { id: engagementId },
    data: {
      onboardingData: { ...onboardingData, proposalBuilderState } as Prisma.InputJsonValue,
      onboardingFee,
      onboardingFeeStatus,
      scopingMode: "AGREEMENT",
      isExpedited: true,
      ...(engagement.signedAt
        ? {}
        : { agreementText: null, agreementTextHash: null }),
    },
  });

  return NextResponse.json({ ok: true });
}

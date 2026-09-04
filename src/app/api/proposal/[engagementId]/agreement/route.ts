import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateProposalAgreementText } from "@/lib/engagements/agreementGenerator";
import { renderAgreementTemplate } from "@/lib/agreements/template";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ engagementId: string }> },
) {
  const { engagementId } = await params;

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: {
      brandId: true,
      clientName: true,
      primaryContactName: true,
      primaryContactEmail: true,
      onboardingFee: true,
      onboardingData: true,
      agreementText: true,
      signedAt: true,
      signerName: true,
      signerTitle: true,
      onboardingFeeStatus: true,
      agreementManagerStatus: true,
      agreementCancellationRequestedAt: true,
      agreementCancellationReason: true,
    },
  });
  if (!engagement) {
    return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
  }

  const brand = await prisma.brand.findUnique({
    where: { id: engagement.brandId },
    select: { name: true },
  });

  function isRecord(v: unknown): v is Record<string, unknown> {
    return Boolean(v) && typeof v === "object" && !Array.isArray(v);
  }

  const onboardingData = isRecord(engagement.onboardingData) ? engagement.onboardingData : {};
  const builderState = isRecord(onboardingData.proposalBuilderState) ? onboardingData.proposalBuilderState : {};
  const assessment = isRecord(builderState.assessment) ? builderState.assessment : {};
  const services = isRecord(builderState.services) ? builderState.services : {};
  const tierLabel = typeof services.selectedTierLabel === "string" ? services.selectedTierLabel : null;
  const hasCleanup = Boolean(builderState.hasCleanup);
  const templateContent = typeof assessment.agreementTemplateContent === "string"
    ? assessment.agreementTemplateContent
    : null;
  const renderInput = {
    brandName: brand?.name ?? "Bookkeeping Conroe",
    clientName: engagement.clientName || "Client",
    primaryContactName: engagement.primaryContactName,
    primaryContactEmail: engagement.primaryContactEmail,
    selectedTierLabel: tierLabel,
    onboardingFee: engagement.onboardingFee ? Number(engagement.onboardingFee) : null,
    hasCleanup,
  };

  let text = engagement.agreementText ?? "";
  if (!engagement.signedAt && !text) {
    text = templateContent
      ? renderAgreementTemplate(templateContent, renderInput)
      : generateProposalAgreementText(renderInput);
    await prisma.engagement.update({
      where: { id: engagementId },
      data: { agreementText: text },
    });
  }

  return NextResponse.json({
    text,
    signed: Boolean(engagement.signedAt),
    signerName: engagement.signerName,
    signerTitle: engagement.signerTitle,
    signedAt: engagement.signedAt ? engagement.signedAt.toISOString() : null,
    onboardingFeeStatus: engagement.onboardingFeeStatus,
    agreementManagerStatus: engagement.agreementManagerStatus,
    cancellationRequestedAt: engagement.agreementCancellationRequestedAt?.toISOString() ?? null,
    cancellationReason: engagement.agreementCancellationReason,
  });
}

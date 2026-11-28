import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateProposalAgreementText } from "@/lib/engagements/agreementGenerator";
import { hasPublicProposalAccess, publicProposalNotFound } from "@/lib/engagements/publicProposalAccess";
import { readAcceptedSelection } from "@/lib/engagements/acceptedPayment";
import { parseStoredProposalCheckout } from "@/lib/engagements/proposalCheckout";
import { serviceLevelDescription } from "@/lib/quotes/serviceLevels";
import { normalizeAccountInventory, summarizeAccountInventory } from "@/lib/quotes/accountInventory";
import { isHourlyOfferKind } from "@/lib/quotes/kinds";
import { lockQuoteMutation, QuoteMutationConflictError } from "@/lib/quotes/mutationLock";
import { isQuoteFrozen } from "@/lib/quotes/isQuoteFrozen";
import type { Prisma } from "@prisma/client";
import {
  companyBundleFeeLines,
  resolveBundlePricingOptions,
  resolveCompanyBundleForTier,
} from "@/lib/quotes/companyBundle";
import {
  readCleanupInstallments,
  readCleanupPlan,
  renderAgreementTemplate,
} from "@/lib/agreements/template";
import { requiredOneTimeAddOnsForTier } from "@/lib/quotes/proposalServices";
import { normalizeDesktopMigrationSelection } from "@/lib/quotes/desktopMigration";
import {
  desktopMigrationChoiceLabel,
  desktopMigrationFeeLabel,
  withSizedMigrationFeeLines,
} from "@/lib/quotes/desktopMigrationWiring";
import { storedDesktopMigrationForSnapshot } from "@/lib/quotes/publicProposal";
import { effectiveAssessment } from "@/app/(app)/offers/builder/effectiveAssessment";
import type { AssessmentState } from "@/app/(app)/offers/builder/ProposalCreationWorkspaceDemo";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ engagementId: string }> },
) {
  const { engagementId } = await params;
  if (!await hasPublicProposalAccess(request, engagementId, ["read", "receipt"])) return publicProposalNotFound();

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: {
      brandId: true,
      status: true,
      productKind: true,
      updatedAt: true,
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
      isTestProposal: true,
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
  const services = engagement.signedAt
    ? readAcceptedSelection(onboardingData).services
    : isRecord(builderState.services) ? builderState.services : {};
  const tierLabel = typeof services.tierLabel === "string"
    ? services.tierLabel
    : typeof services.selectedTierLabel === "string" ? services.selectedTierLabel : null;
  const cleanupTotal = typeof services.cleanupTotal === "number" ? services.cleanupTotal : 0;
  const recurringMonthlyTotal = typeof services.recurringMonthlyTotal === "number" ? services.recurringMonthlyTotal : 0;
  const amountDueNow = typeof services.amountDueNow === "number" ? services.amountDueNow : 0;
  const checkout = parseStoredProposalCheckout(services);
  const hasCleanup = checkout?.paymentScheduleVersion === 2 ? (checkout.cleanupMonths ?? 0) > 0 : cleanupTotal > 0;
  // Spec 04: plan + frozen installments ride the stored checkout. The
  // strict shared validators read them (junk is absent, so signed text is
  // never rebuilt with altered terms); the template derives installments
  // from the plan when only the plan is present.
  const cleanupPlan = readCleanupPlan(services.cleanupPlan);
  const cleanupInstallments = readCleanupInstallments(services.cleanupInstallments);
  const selectedCleanupPeriods = Array.isArray(services.selectedCleanupPeriodKeys)
    ? services.selectedCleanupPeriodKeys.filter((value): value is string => typeof value === "string")
    : [];
  const selectedAdditionalOptionIds = Array.isArray(services.selectedAdditionalOptionIds)
    ? services.selectedAdditionalOptionIds.filter((value): value is string => typeof value === "string")
    : [];
  const additionalOptions: Record<string, unknown>[] = [];
  if (Array.isArray(assessment.additionalOptions)) {
    for (const value of assessment.additionalOptions) {
      if (isRecord(value)) additionalOptions.push(value);
    }
  }
  if (Array.isArray(assessment.bonuses)) {
    for (const value of assessment.bonuses) {
      if (isRecord(value)) additionalOptions.push(value);
    }
  }
  const selectedAdditionalOptionNames = selectedAdditionalOptionIds.map((id) => {
    const option = additionalOptions.find((item) => item.id === id);
    return typeof option?.name === "string" ? option.name : id;
  });
  const templateContent = typeof assessment.agreementTemplateContent === "string"
    ? assessment.agreementTemplateContent
    : null;
  const inventory = summarizeAccountInventory(normalizeAccountInventory(assessment.accounts));
  // Spec 02: one fee line per company when the stored assessment has a
  // bundle. Signed/stored text is never rebuilt, so this only affects newly
  // generated agreements; legacy assessments pass nothing (byte-identical).
  // The selected tier reads the snapshot's one bundle object; old snapshots
  // without it fall back to a fresh priceCompanyBundle for that tier.
  const quote = engagement.quotes?.[0];
  const publishedSnapshot = quote?.revisions?.[0]?.snapshotJson ?? quote?.publishedSnapshotJson;
  const snapshotPricing = isRecord(publishedSnapshot) && isRecord(publishedSnapshot.pricing)
    ? publishedSnapshot.pricing
    : undefined;
  const companyBundle = resolveCompanyBundleForTier({
    pricing: snapshotPricing,
    packageId: checkout?.tier ?? "maintain",
    companies: assessment.companies,
    baseAssessment: effectiveAssessment(assessment as unknown as AssessmentState),
    options: resolveBundlePricingOptions(assessment),
  });
  // Spec 05: the sized migration is exactly one fee line in the company
  // bucket — never also in requiredOneTime, so the itemized sum still
  // equals the total. Legacy snapshots (no choice) price exactly as today.
  const migrationChoice = normalizeDesktopMigrationSelection(
    isRecord(publishedSnapshot) && isRecord(publishedSnapshot.assessment)
      ? publishedSnapshot.assessment.desktopMigration
      : null,
  ).choice;
  const storedMigration = storedDesktopMigrationForSnapshot(publishedSnapshot);
  const sizedMigrationLine = migrationChoice !== null && storedMigration
    ? {
        label: desktopMigrationFeeLabel(desktopMigrationChoiceLabel(migrationChoice) ?? "Desktop migration"),
        amount: storedMigration.total,
      }
    : null;
  const companyFeeLines = withSizedMigrationFeeLines(
    companyBundle ? companyBundleFeeLines(companyBundle) : undefined,
    sizedMigrationLine,
  );
  const renderInput = {
    brandName: brand?.name ?? "Bookkeeping Conroe",
    clientName: engagement.clientName || "Client",
    volumeMonthlyTotal: inventory.hasInventory ? inventory.openMonthlyTotal : null,
    volumeBasis: inventory.basis,
    includeVolumeClause: !isHourlyOfferKind(engagement.productKind),
    primaryContactName: engagement.primaryContactName,
    primaryContactEmail: engagement.primaryContactEmail,
    selectedTierLabel: tierLabel,
    onboardingFee: engagement.onboardingFee ? Number(engagement.onboardingFee) : null,
    hasCleanup,
    recurringMonthlyTotal,
    cleanupTotal,
    amountDueNow,
    creditApplied: checkout?.creditApplied,
    // Spec 06: the frozen start month (explicit staff month, or the
    // wrap-up-derived month on cleanup checkouts). Legacy checkouts carry
    // none and render byte-identical.
    serviceStartMonth: checkout?.serviceStartMonth ?? null,
    // The applied-credit label reads the stored reason when one exists —
    // the checkout carries it whenever a credit with a reason exists; fall
    // back to the stored assessment's reason for legacy checkouts that
    // predate the carry.
    firstPaymentCreditReason: checkout?.firstPaymentCreditReason
      ?? (typeof assessment.firstPaymentCreditReason === "string" ? assessment.firstPaymentCreditReason : null),
    creditRemaining: checkout?.creditRemaining ?? null,
    creditRemainingReason: checkout?.creditRemainingReason ?? null,
    agreementTerm: services.hasTwelveMonthAgreement === true ? "12-month" as const : "month-to-month" as const,
    selectedCleanupPeriods,
    selectedAdditionalOptionNames,
    companyFeeLines,
    paymentScheduleVersion: checkout?.paymentScheduleVersion,
    cleanupMonths: checkout?.cleanupMonths,
    cleanupMonthlyRate: checkout?.cleanupMonthlyRate,
    cleanupPlan,
    cleanupInstallments,
    complexityCleanupAdd: checkout?.complexityCleanupAdd,
    monthlyRate: recurringMonthlyTotal,
    additionalOneTimeTotal: checkout?.additionalOneTimeTotal,
    // Tier-filtered exactly like checkout, so no line appears that isn't
    // charged on the selected tier.
    requiredOneTime: requiredOneTimeAddOnsForTier(
      assessment,
      selectedAdditionalOptionIds,
      checkout?.tier ?? "maintain",
    ),
    // Stored at selection time; re-resolve so support-level wording is current.
    includedServices: checkout?.includedServices?.map((item) => ({
      ...item,
      description: serviceLevelDescription(item.name, item.description),
    })),
  };

  let text = engagement.agreementText ?? "";
  if (!engagement.signedAt && !text) {
    if (isQuoteFrozen(engagement)) return NextResponse.json({ error: "Accepted, signed or paid offers are frozen." }, { status: 409 });
    text = templateContent
      ? renderAgreementTemplate(templateContent, renderInput)
      : generateProposalAgreementText(renderInput);
    const updated = await prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findFirst({ where: { engagementId, brandId: engagement.brandId }, select: { id: true } });
      if (!quote) throw new QuoteMutationConflictError("Offer not found.");
      await lockQuoteMutation(tx, engagement.brandId, quote.id, "prepare");
      return tx.engagement.updateMany({
      where: { id: engagementId, brandId: engagement.brandId, signedAt: null, updatedAt: engagement.updatedAt,
        onboardingData: { equals: onboardingData as Prisma.InputJsonValue } },
      data: { agreementText: text },
      });
    }).catch((error: unknown) => {
      if (error instanceof QuoteMutationConflictError) return { count: 0 };
      throw error;
    });
    if (updated.count !== 1) return NextResponse.json({ error: "The agreement changed. Reload before signing." }, { status: 409 });
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
    checkout: parseStoredProposalCheckout(services),
    isTestProposal: engagement.isTestProposal,
  });
}

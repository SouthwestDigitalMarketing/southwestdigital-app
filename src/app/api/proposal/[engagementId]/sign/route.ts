import { saveAcceptedCopy } from "@/lib/quotes/acceptedCopy";
import { sendProposalAlert } from "@/lib/notifications/staffAlert";
import { after, NextResponse } from "next/server";
import { headers } from "next/headers";
import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { getSelectedProposalTier } from "@/lib/engagements/proposalSelection";
import { hasPublicProposalAccess, publicProposalNotFound } from "@/lib/engagements/publicProposalAccess";
import { buildAcceptedPayment } from "@/lib/engagements/acceptedPayment";
import { readCreditCarryover } from "@/lib/quotes/serviceStart";
import { lockQuoteMutation, QuoteMutationConflictError } from "@/lib/quotes/mutationLock";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ engagementId: string }> },
) {
  const { engagementId } = await params;
  if (!await hasPublicProposalAccess(request, engagementId, "sign")) return publicProposalNotFound();

  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || headersList.get("x-real-ip") || "unknown";

  const rateLimit = checkRateLimit(`sign:${engagementId}:${ip}`, 10, 10 * 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Please try again shortly." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as {
    signerName?: unknown;
    signerTitle?: unknown;
    email?: unknown;
    consentToElectronicSignature?: unknown;
    confirmedReadAndAgreed?: unknown;
    confirmedScrolledAgreement?: unknown;
  } | null;

  const signerName = typeof body?.signerName === "string" ? body.signerName.trim() : "";
  const signerTitle = typeof body?.signerTitle === "string" ? body.signerTitle.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const consentGiven = body?.consentToElectronicSignature === true;
  const readAndAgreed = body?.confirmedReadAndAgreed === true;
  const scrolledToEnd = body?.confirmedScrolledAgreement === true;

  if (!signerName) return NextResponse.json({ error: "Please enter your full name to sign." }, { status: 400 });
  if (!isValidEmail(email)) return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  if (!scrolledToEnd) return NextResponse.json({ error: "Please review the full agreement before signing." }, { status: 400 });
  if (!readAndAgreed) return NextResponse.json({ error: "Please confirm you have read and agree to the agreement." }, { status: 400 });
  if (!consentGiven) return NextResponse.json({ error: "Please confirm you consent to sign electronically." }, { status: 400 });

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { brandId: true, onboardingData: true, onboardingFeeStatus: true, agreementText: true, signedAt: true, signerName: true, agreementManagerStatus: true, productKind: true, isTestProposal: true, updatedAt: true },
  });
  if (!engagement) return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
  const isHourlyKind = engagement.productKind === "consulting" || engagement.productKind === "coaching";

  if (engagement.agreementManagerStatus === "VOIDED" || engagement.agreementManagerStatus === "VOIDED_BEFORE_SIGNATURE" || engagement.agreementManagerStatus === "CANCELLATION_REQUESTED" || engagement.agreementManagerStatus === "TERMINATED_AFTER_SIGNATURE") {
    return NextResponse.json({ error: "This agreement is no longer available for signing." }, { status: 409 });
  }

  if (engagement.signedAt) {
    return NextResponse.json({ ok: true, signedAt: engagement.signedAt.toISOString(), signerName: engagement.signerName });
  }

  if (!isHourlyKind && !getSelectedProposalTier(engagement.onboardingData)) {
    return NextResponse.json({ error: "Please select a service tier first." }, { status: 400 });
  }
  if (!engagement.agreementText?.trim()) {
    return NextResponse.json({ error: "The agreement could not be frozen for signing. Please reload and try again." }, { status: 409 });
  }

  const signerIpAddress = ip === "unknown" ? null : ip;
  const signerUserAgent = headersList.get("user-agent") || null;
  const agreementTextHash = createHash("sha256").update(engagement.agreementText ?? "").digest("hex");

  const onboardingFeeStatus =
    engagement.onboardingFeeStatus && engagement.onboardingFeeStatus !== "REQUIRED"
      ? engagement.onboardingFeeStatus
      : "INVOICED";

  const signedAt = new Date();
  const onboardingData = isRecord(engagement.onboardingData) ? engagement.onboardingData : {};
  const builderState = isRecord(onboardingData.proposalBuilderState) ? onboardingData.proposalBuilderState : {};
  const services = isRecord(builderState.services) ? builderState.services : {};
  const paymentObligation = buildAcceptedPayment(services, engagement.isTestProposal);
  if (!paymentObligation) return NextResponse.json({ error: "The pricing could not be frozen. Please reload and select the published offer again." }, { status: 409 });
  // Spec 06: when the stored checkout carries an excess credit, freeze the
  // remainder on the acceptance so whoever sends the next invoice applies it.
  // Written atomically with the acceptance (same guards/transaction), never
  // on a frozen/already-signed re-run, and with no new client message.
  const creditCarryover = readCreditCarryover(services);
  const proposalAcceptance = {
    version: 2,
    signedAt: signedAt.toISOString(),
    agreementText: engagement.agreementText,
    agreementTextHash,
    selection: services,
    paymentObligation,
    ...(creditCarryover ? {
      creditRemaining: creditCarryover.creditRemaining,
      creditRemainingReason: creditCarryover.creditRemainingReason,
    } : {}),
    signer: {
      name: signerName,
      title: signerTitle || null,
      email,
      ipAddress: signerIpAddress,
      userAgent: signerUserAgent,
    },
    consent: {
      electronicSignature: true,
      readAndAgreed: true,
      scrolledToEnd: true,
    },
  };
  const recorded = await prisma.$transaction(async (tx) => {
  const quote = await tx.quote.findFirst({ where: { engagementId, brandId: engagement.brandId }, select: { id: true } });
  if (!quote) return false;
  await lockQuoteMutation(tx, engagement.brandId, quote.id, "sign");
  const revision = await tx.quoteRevision.findFirst({
    where: { quoteId: quote.id, brandId: engagement.brandId }, orderBy: { version: "desc" }, select: { id: true, version: true },
  });
  const updated = await tx.engagement.updateMany({
    where: { id: engagementId, brandId: engagement.brandId, signedAt: null, updatedAt: engagement.updatedAt },
    data: {
      signerName,
      signerTitle: signerTitle || null,
      signedAt,
      status: "SIGNED",
      signerIpAddress,
      signerUserAgent,
      agreementTextHash,
      consentToElectronicSignature: true,
      agreementReadAndAgreed: true,
      agreementScrolledToEnd: true,
      agreementScrolledAt: signedAt,
      billingContactEmail: email,
      onboardingFeeStatus,
      onboardingData: { ...onboardingData, proposalAcceptance: {
        ...proposalAcceptance,
        publication: { quoteId: quote.id, revisionId: revision?.id ?? null, version: revision?.version ?? null },
      } } as Prisma.InputJsonValue,
    },
  });
  if (updated.count !== 1) return false;
  await tx.quote.updateMany({
    where: { engagementId, brandId: engagement.brandId, status: { notIn: ["archived", "completed"] } },
    data: { status: "accepted", lastActivityAt: signedAt },
  });
  return true;
  }).catch((error: unknown) => {
    if (error instanceof QuoteMutationConflictError) return false;
    throw error;
  });
  if (!recorded) return NextResponse.json({ error: "The proposal changed or was signed in another tab. Reload to see the current agreement." }, { status: 409 });

  // The copy is made after the signing transaction commits, never inside it.
  // It must not delay or fail signing: after() runs it after the response, and
  // any failure is only logged. The fetched page carries the internal marker,
  // so no client view, activity or status change is recorded.
  const copyTask = saveAcceptedCopy({
    // No request-derived origin: saveAcceptedCopy self-fetches from the
    // brand's own verified proposal host (allowlisted), never Host headers.
    brandId: engagement.brandId, engagementId, source: "accept",
  }).catch(() => {
    // Copy failures must never undo or fail a successful client signature.
    console.error("[proposal/sign] Accepted copy could not be saved", { engagementId });
  });
  try {
    after(copyTask);
  } catch {
    // after() is unavailable outside a request scope (unit tests): copyTask
    // above is already running fire-and-forget, so there is nothing to redo.
  }

  await sendProposalAlert(engagementId, engagement.brandId, {
    kind: "signed",
    amount: paymentObligation.amountInCents / 100,
    currency: paymentObligation.currency,
    detail: typeof services.tierLabel === "string" ? `Plan: ${services.tierLabel}. Due now, not yet paid.` : "Due now, not yet paid.",
  });

  return NextResponse.json({ ok: true, signedAt: signedAt.toISOString(), signerName });
}

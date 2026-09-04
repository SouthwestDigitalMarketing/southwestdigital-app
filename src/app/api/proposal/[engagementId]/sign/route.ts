import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { getSelectedProposalTier } from "@/lib/engagements/proposalSelection";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ engagementId: string }> },
) {
  const { engagementId } = await params;

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
    select: { brandId: true, onboardingData: true, onboardingFeeStatus: true, agreementText: true, signedAt: true, signerName: true, agreementManagerStatus: true },
  });
  if (!engagement) return NextResponse.json({ error: "Engagement not found" }, { status: 404 });

  if (engagement.agreementManagerStatus === "VOIDED" || engagement.agreementManagerStatus === "VOIDED_BEFORE_SIGNATURE" || engagement.agreementManagerStatus === "CANCELLATION_REQUESTED" || engagement.agreementManagerStatus === "TERMINATED_AFTER_SIGNATURE") {
    return NextResponse.json({ error: "This agreement is no longer available for signing." }, { status: 409 });
  }

  if (engagement.signedAt) {
    await prisma.quote.updateMany({
      where: { engagementId, brandId: engagement.brandId, status: { not: "archived" } },
      data: { status: "accepted" },
    });
    return NextResponse.json({ ok: true, signedAt: engagement.signedAt.toISOString(), signerName: engagement.signerName });
  }

  if (!getSelectedProposalTier(engagement.onboardingData)) {
    return NextResponse.json({ error: "Please select a service tier first." }, { status: 400 });
  }

  const signerIpAddress = ip === "unknown" ? null : ip;
  const signerUserAgent = headersList.get("user-agent") || null;
  const agreementTextHash = createHash("sha256").update(engagement.agreementText ?? "").digest("hex");

  const onboardingFeeStatus =
    engagement.onboardingFeeStatus && engagement.onboardingFeeStatus !== "REQUIRED"
      ? engagement.onboardingFeeStatus
      : "INVOICED";

  const signedAt = new Date();
  await prisma.engagement.update({
    where: { id: engagementId },
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
    },
  });
  await prisma.quote.updateMany({
    where: { engagementId, brandId: engagement.brandId, status: { not: "archived" } },
    data: { status: "accepted" },
  });

  return NextResponse.json({ ok: true, signedAt: signedAt.toISOString(), signerName });
}

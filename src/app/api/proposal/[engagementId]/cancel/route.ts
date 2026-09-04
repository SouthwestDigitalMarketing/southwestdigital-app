import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { hasPublicProposalAccess, publicProposalNotFound } from "@/lib/engagements/publicProposalAccess";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ engagementId: string }> },
) {
  const { engagementId } = await params;
  if (!await hasPublicProposalAccess(request, engagementId)) return publicProposalNotFound();
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || headersList.get("x-real-ip") || "unknown";
  const rateLimit = checkRateLimit(`cancel:${engagementId}:${ip}`, 5, 10 * 60_000);
  if (!rateLimit.allowed) return NextResponse.json({ error: "Too many attempts. Please try again shortly." }, { status: 429 });

  const body = (await request.json().catch(() => null)) as { name?: unknown; email?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!name) return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
  if (!isValidEmail(email)) return NextResponse.json({ error: "A valid email is required." }, { status: 400 });

  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { agreementManagerStatus: true, signedAt: true, signerName: true, billingContactEmail: true },
  });
  if (!engagement) return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
  if (engagement.agreementManagerStatus !== "CANCELLATION_REQUESTED" || !engagement.signedAt) {
    return NextResponse.json({ error: "There is no pending cancellation request for this agreement." }, { status: 409 });
  }
  if (engagement.signerName && engagement.signerName.toLowerCase() !== name.toLowerCase()) {
    return NextResponse.json({ error: "The name must match the person who signed the agreement." }, { status: 403 });
  }
  if (engagement.billingContactEmail && engagement.billingContactEmail.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: "The email must match the signer’s email." }, { status: 403 });
  }

  const acknowledgedAt = new Date();
  await prisma.engagement.update({
    where: { id: engagementId },
    data: {
      agreementManagerStatus: "TERMINATED_AFTER_SIGNATURE",
      agreementCancellationAcknowledgedAt: acknowledgedAt,
      agreementCancellationAcknowledgedByName: name,
      agreementCancellationAcknowledgedByEmail: email,
    },
  });
  return NextResponse.json({ ok: true, acknowledgedAt: acknowledgedAt.toISOString() });
}

import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/simpleRateLimit";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateLimit = checkRateLimit(`agreement-cancellation:${ip}`, 5, 10 * 60_000);
  if (!rateLimit.allowed) return NextResponse.json({ error: "Too many attempts. Please try again shortly." }, { status: 429 });
  const body = (await request.json().catch(() => null)) as { name?: unknown; email?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!name || !isValidEmail(email)) return NextResponse.json({ error: "Enter the signer name and a valid email." }, { status: 400 });
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const agreement = await prisma.engagement.findFirst({
    where: { agreementCancellationTokenHash: tokenHash },
    select: { id: true, agreementManagerStatus: true, agreementCancellationTokenExpiresAt: true, signerName: true, billingContactEmail: true },
  });
  if (!agreement || agreement.agreementCancellationTokenExpiresAt && agreement.agreementCancellationTokenExpiresAt < new Date()) {
    return NextResponse.json({ error: "This cancellation link is invalid or expired." }, { status: 410 });
  }
  if (agreement.agreementManagerStatus !== "CANCELLATION_REQUESTED") return NextResponse.json({ error: "This cancellation request is no longer pending." }, { status: 409 });
  if (agreement.signerName && agreement.signerName.toLowerCase() !== name.toLowerCase()) return NextResponse.json({ error: "The name must match the signer." }, { status: 403 });
  if (agreement.billingContactEmail && agreement.billingContactEmail.toLowerCase() !== email.toLowerCase()) return NextResponse.json({ error: "The email must match the signer." }, { status: 403 });
  const acknowledgedAt = new Date();
  await prisma.engagement.update({
    where: { id: agreement.id },
    data: {
      agreementManagerStatus: "TERMINATED_AFTER_SIGNATURE",
      agreementCancellationAcknowledgedAt: acknowledgedAt,
      agreementCancellationAcknowledgedByName: name,
      agreementCancellationAcknowledgedByEmail: email,
      agreementCancellationTokenHash: null,
      agreementCancellationTokenExpiresAt: null,
    },
  });
  return NextResponse.json({ ok: true });
}

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { resolvePublicBrand } from "@/lib/brands/resolve";
import { createSignedProposalPdf } from "@/lib/agreements/signedPdf";
import { parseStoredProposalCheckout } from "@/lib/engagements/proposalCheckout";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ engagementId: string }> },
) {
  const { engagementId: publicToken } = await params;
  const hostname = (await headers()).get("x-hostname");
  const brand = await resolvePublicBrand(hostname);
  if (!brand) return Response.json({ error: "Not found" }, { status: 404 });

  const quote = await prisma.quote.findFirst({
    where: { brandId: brand.id, publicToken, publishedAt: { not: null } },
    select: {
      offerCode: true,
      engagement: {
        select: {
          clientName: true,
          onboardingData: true,
          agreementText: true,
          agreementTextHash: true,
          signerName: true,
          signerTitle: true,
          billingContactEmail: true,
          signedAt: true,
          signerIpAddress: true,
          signerUserAgent: true,
        },
      },
    },
  });
  const engagement = quote?.engagement;
  if (!quote || !engagement?.signedAt || !engagement.agreementText || !engagement.signerName) {
    return Response.json({ error: "A signed agreement was not found." }, { status: 404 });
  }

  const onboardingData = isRecord(engagement.onboardingData) ? engagement.onboardingData : {};
  const builderState = isRecord(onboardingData.proposalBuilderState) ? onboardingData.proposalBuilderState : {};
  const services = isRecord(builderState.services) ? builderState.services : {};
  const checkout = parseStoredProposalCheckout(services);
  const acceptance = isRecord(onboardingData.proposalAcceptance) ? onboardingData.proposalAcceptance : {};
  const payment = isRecord(acceptance.payment) ? acceptance.payment : {};
  const amountPaid = typeof payment.amount === "number" ? payment.amount : null;
  const paidAt = typeof payment.paidAt === "string" ? new Date(payment.paidAt) : null;

  const bytes = await createSignedProposalPdf({
    brandName: brand.name,
    offerCode: quote.offerCode,
    clientName: engagement.clientName,
    tierLabel: checkout?.tierLabel ?? "Recorded package",
    recurringMonthlyTotal: checkout?.recurringMonthlyTotal ?? 0,
    oneTimeTotal: checkout?.oneTimeTotal ?? 0,
    amountPaid,
    currency: typeof payment.currency === "string" ? payment.currency : "USD",
    agreementText: engagement.agreementText,
    agreementTextHash: engagement.agreementTextHash
      ?? createHash("sha256").update(engagement.agreementText).digest("hex"),
    signerName: engagement.signerName,
    signerTitle: engagement.signerTitle,
    signerEmail: engagement.billingContactEmail,
    signedAt: engagement.signedAt,
    signerIpAddress: engagement.signerIpAddress,
    signerUserAgent: engagement.signerUserAgent,
    paymentProvider: typeof payment.provider === "string" ? payment.provider : null,
    paymentReference: typeof payment.reference === "string" ? payment.reference : null,
    paidAt: paidAt && !Number.isNaN(paidAt.getTime()) ? paidAt : null,
  });
  const safeOfferCode = quote.offerCode.replace(/[^a-zA-Z0-9_-]/g, "-");
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="signed-proposal-${safeOfferCode}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

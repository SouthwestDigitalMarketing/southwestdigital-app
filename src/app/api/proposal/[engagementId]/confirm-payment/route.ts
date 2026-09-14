import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPublicProposalAccess, publicProposalNotFound } from "@/lib/engagements/publicProposalAccess";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ engagementId: string }> },
) {
  const { engagementId } = await params;
  if (!await hasPublicProposalAccess(request, engagementId, "receipt")) return publicProposalNotFound();
  const engagement = await prisma.engagement.findUnique({
    where: { id: engagementId },
    select: { onboardingFeeStatus: true },
  });
  if (!engagement) return NextResponse.json({ error: "Engagement not found" }, { status: 404 });
  if (engagement.onboardingFeeStatus === "PAID") return NextResponse.json({ ok: true, paid: true });
  return NextResponse.json({ ok: true, paid: false });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PipeBrandError, resolveBrand } from "@/lib/pipe/contacts";
import { authenticateOperationsRequest } from "@/lib/operations/api";
import { onClientWon } from "@/lib/operations/clientWon";

export const dynamic = "force-dynamic";

/**
 * Re-runs the client-won steps for a paid engagement: backfill for clients
 * who paid before the automation existed, and a retry after a failed step.
 * Every step is idempotent.
 */
export async function POST(request: Request) {
  const auth = authenticateOperationsRequest(request.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 503 ? "Operations API is not configured." : "Unauthorized." },
      { status: auth.status },
    );
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const engagementId = typeof body?.engagementId === "string" ? body.engagementId.trim() : "";
  if (!engagementId) return NextResponse.json({ error: "engagementId is required." }, { status: 400 });
  try {
    const brand = await resolveBrand(typeof body?.brand === "string" ? body.brand.trim() : "");
    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, brandId: brand.id },
      select: { id: true },
    });
    if (!engagement) return NextResponse.json({ error: "Engagement not found for this brand." }, { status: 404 });
    return NextResponse.json(await onClientWon(engagementId, brand.id));
  } catch (error) {
    if (error instanceof PipeBrandError) return NextResponse.json({ error: error.message }, { status: 404 });
    throw error;
  }
}

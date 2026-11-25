import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { PipeBrandError, resolveBrand } from "@/lib/pipe/contacts";
import { parseReview } from "@/lib/showrunner/review";
import { checkStatusToken } from "@/lib/showrunner/video-status";
import { createBrandDataContext, withBrandDataTransaction } from "@/lib/tenancy/context";

export const dynamic = "force-dynamic";

/**
 * The video scorecard, between ripley and SWapp (Tom, 2026-11-25). Same token as the video status push.
 * GET ?brand=<slug>: the videos someone tapped Run review on, for ripley to review.
 * POST { brand, batch, review }: ripley's finished review; clears the request.
 */
async function brandOf(request: Request, slug: string) {
  const auth = checkStatusToken(request.headers.get("authorization"));
  if (!auth.ok) {
    const message = auth.status === 503 ? "Video status is not configured." : "Unauthorized.";
    return { error: NextResponse.json({ error: message }, { status: auth.status }) };
  }
  if (!checkRateLimit("showrunner-video-review", 60, 60_000).allowed) {
    return { error: NextResponse.json({ error: "Too many requests." }, { status: 429 }) };
  }
  if (!slug) return { error: NextResponse.json({ error: "brand is required." }, { status: 400 }) };
  try {
    const brand = await resolveBrand(slug);
    return { brand, context: createBrandDataContext({ brandId: brand.id, actorUserId: auth.actorUserId }) };
  } catch (error) {
    if (error instanceof PipeBrandError) return { error: NextResponse.json({ error: error.message }, { status: 404 }) };
    throw error;
  }
}

export async function GET(request: Request) {
  const found = await brandOf(request, new URL(request.url).searchParams.get("brand")?.trim() ?? "");
  if ("error" in found) return found.error;
  const rows = await withBrandDataTransaction(found.context, (tx) =>
    tx.showrunnerVideoStatus.findMany({
      where: { brandId: found.brand.id, reviewRequestedAt: { not: null } },
      orderBy: { reviewRequestedAt: "asc" },
      take: 20,
      select: { batch: true, project: true, reviewRequestedAt: true },
    }),
  );
  return NextResponse.json({ requests: rows });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { brand?: unknown; batch?: unknown; review?: unknown } | null;
  const found = await brandOf(request, typeof body?.brand === "string" ? body.brand.trim() : "");
  if ("error" in found) return found.error;
  const batch = typeof body?.batch === "string" ? body.batch.trim() : "";
  const review = parseReview(body?.review);
  if (!/^[A-Za-z0-9-]{1,60}$/.test(batch) || !review) {
    return NextResponse.json({ error: "batch and a review with items are required." }, { status: 400 });
  }
  const saved = await withBrandDataTransaction(found.context, (tx) =>
    tx.showrunnerVideoStatus.updateMany({
      where: { brandId: found.brand.id, batch },
      data: { review, reviewRequestedAt: null },
    }),
  );
  if (saved.count === 0) return NextResponse.json({ error: "No such video." }, { status: 404 });
  return NextResponse.json({ saved: true, score: review.score });
}

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { PipeBrandError, resolveBrand } from "@/lib/pipe/contacts";
import { checkStatusToken } from "@/lib/showrunner/video-status";
import { createBrandDataContext, withBrandDataTransaction } from "@/lib/tenancy/context";

export const dynamic = "force-dynamic";

/**
 * Teaser taps from SWapp (Tom, 2026-11-27). Same token as the video status push.
 * GET ?brand=<slug>: videos someone picked a new teaser for, or turned it off.
 * POST { brand, batch }: ripley started the splice; clears the flag.
 */
async function brandOf(request: Request, slug: string) {
  const auth = checkStatusToken(request.headers.get("authorization"));
  if (!auth.ok) {
    const message = auth.status === 503 ? "Video status is not configured." : "Unauthorized.";
    return { error: NextResponse.json({ error: message }, { status: auth.status }) };
  }
  if (!checkRateLimit("showrunner-teaser", 60, 60_000).allowed) {
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
      where: { brandId: found.brand.id, teaserRequestedAt: { not: null } },
      orderBy: { teaserRequestedAt: "asc" },
      take: 20,
      select: { batch: true, project: true, teaserRequest: true, teaserRequestedAt: true },
    }),
  );
  return NextResponse.json({
    requests: rows.map((row) => {
      const body = row.teaserRequest && typeof row.teaserRequest === "object" ? (row.teaserRequest as Record<string, unknown>) : {};
      return {
        batch: row.batch,
        project: row.project,
        wanted: body.wanted !== false,
        start: typeof body.start === "number" ? body.start : null,
        end: typeof body.end === "number" ? body.end : null,
        teaserRequestedAt: row.teaserRequestedAt,
      };
    }),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { brand?: unknown; batch?: unknown } | null;
  const found = await brandOf(request, typeof body?.brand === "string" ? body.brand.trim() : "");
  if ("error" in found) return found.error;
  const batch = typeof body?.batch === "string" ? body.batch.trim() : "";
  if (!/^[A-Za-z0-9-]{1,60}$/.test(batch)) {
    return NextResponse.json({ error: "batch is required." }, { status: 400 });
  }
  const saved = await withBrandDataTransaction(found.context, (tx) =>
    tx.showrunnerVideoStatus.updateMany({
      where: { brandId: found.brand.id, batch },
      data: { teaserRequestedAt: null, teaserRequest: Prisma.JsonNull, teaserBusy: true },
    }),
  );
  if (saved.count === 0) return NextResponse.json({ error: "No such video." }, { status: 404 });
  return NextResponse.json({ saved: true });
}

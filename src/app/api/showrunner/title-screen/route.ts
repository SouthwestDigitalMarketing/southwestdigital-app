import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { PipeBrandError, resolveBrand } from "@/lib/pipe/contacts";
import { checkStatusToken } from "@/lib/showrunner/video-status";
import { createBrandDataContext, withBrandDataTransaction } from "@/lib/tenancy/context";

export const dynamic = "force-dynamic";

/**
 * Title-screen Approve from SWapp (Tom, 2026-11-28). Same token as the video status push.
 * GET ?brand=<slug>: videos whose still Tom approved, waiting for a recut.
 * POST { brand, batch }: ripley started the recut; clears the flag.
 * POST { brand, batch, done: true }: recut finished; clears busy.
 */
async function brandOf(request: Request, slug: string) {
  const auth = checkStatusToken(request.headers.get("authorization"));
  if (!auth.ok) {
    const message = auth.status === 503 ? "Video status is not configured." : "Unauthorized.";
    return { error: NextResponse.json({ error: message }, { status: auth.status }) };
  }
  if (!checkRateLimit("showrunner-title-screen", 60, 60_000).allowed) {
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
      where: { brandId: found.brand.id, titleScreenRecutRequestedAt: { not: null } },
      orderBy: { titleScreenRecutRequestedAt: "asc" },
      take: 20,
      select: { batch: true, project: true, titleScreenRecutRequestedAt: true },
    }),
  );
  return NextResponse.json({
    requests: rows.map((row) => ({
      batch: row.batch,
      project: row.project,
      titleScreenRecutRequestedAt: row.titleScreenRecutRequestedAt,
    })),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { brand?: unknown; batch?: unknown; done?: unknown } | null;
  const found = await brandOf(request, typeof body?.brand === "string" ? body.brand.trim() : "");
  if ("error" in found) return found.error;
  const batch = typeof body?.batch === "string" ? body.batch.trim() : "";
  if (!/^[A-Za-z0-9-]{1,60}$/.test(batch)) {
    return NextResponse.json({ error: "batch is required." }, { status: 400 });
  }
  const done = body?.done === true;
  const saved = await withBrandDataTransaction(found.context, (tx) =>
    tx.showrunnerVideoStatus.updateMany({
      where: { brandId: found.brand.id, batch },
      data: done
        ? { titleScreenRecutRequestedAt: null, titleScreenBusy: false }
        : { titleScreenRecutRequestedAt: null, titleScreenBusy: true },
    }),
  );
  if (saved.count === 0) return NextResponse.json({ error: "No such video." }, { status: 404 });
  return NextResponse.json({ saved: true });
}

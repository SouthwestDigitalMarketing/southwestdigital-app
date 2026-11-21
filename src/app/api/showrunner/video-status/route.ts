import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { PipeBrandError, resolveBrand } from "@/lib/pipe/contacts";
import { checkStatusToken, parseVideoStatus } from "@/lib/showrunner/video-status";
import { createBrandDataContext, withBrandDataTransaction } from "@/lib/tenancy/context";

export const dynamic = "force-dynamic";

/**
 * Ripley pushes its phone-batch status here (scripts/push_video_status.py): every
 * video's autopilot steps, render bars, title, thumbnail, details and YouTube link, for the Showrunner page.
 * Body: { brand: "<slug>", videos: [queue.json rows] }.
 */
export async function POST(request: Request) {
  const auth = checkStatusToken(request.headers.get("authorization"));
  if (!auth.ok) {
    const message = auth.status === 503 ? "Video status is not configured." : "Unauthorized.";
    return NextResponse.json({ error: message }, { status: auth.status });
  }
  if (!checkRateLimit("showrunner-video-status", 30, 60_000).allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { brand?: unknown; videos?: unknown } | null;
  const slug = typeof body?.brand === "string" ? body.brand.trim() : "";
  if (!slug || !Array.isArray(body?.videos)) {
    return NextResponse.json({ error: "brand and videos are required." }, { status: 400 });
  }
  let brand;
  try {
    brand = await resolveBrand(slug);
  } catch (error) {
    if (error instanceof PipeBrandError) return NextResponse.json({ error: error.message }, { status: 404 });
    throw error;
  }
  const rows = body.videos.slice(0, 50).map(parseVideoStatus).filter((row) => row !== null);
  const context = createBrandDataContext({ brandId: brand.id, actorUserId: auth.actorUserId });
  await withBrandDataTransaction(context, async (tx) => {
    for (const row of rows) {
      const data = {
        project: row.project,
        state: row.state,
        stage: row.stage,
        // JsonNull clears the column, so finished renders lose their bars.
        steps: row.steps ?? Prisma.JsonNull,
        render: row.render ?? Prisma.JsonNull,
        url: row.url,
        title: row.title,
        thumbnail: row.thumbnail,
        details: row.details ?? Prisma.JsonNull,
        sentAt: row.sentAt,
      };
      await tx.showrunnerVideoStatus.upsert({
        where: { brandId_batch: { brandId: brand.id, batch: row.batch } },
        create: { brandId: brand.id, batch: row.batch, ...data },
        update: data,
      });
    }
  });
  return NextResponse.json({ saved: rows.length });
}

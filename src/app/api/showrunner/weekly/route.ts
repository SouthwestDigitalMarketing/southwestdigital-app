import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { PipeBrandError, resolveBrand } from "@/lib/pipe/contacts";
import { checkStatusToken } from "@/lib/showrunner/video-status";
import { parseWeek } from "@/lib/showrunner/weekly";
import { createBrandDataContext, withBrandDataTransaction } from "@/lib/tenancy/context";

export const dynamic = "force-dynamic";

/**
 * Ripley pushes the Sunday wrap-up week here (showrunner_weekly.py prepare, Saturdays and on demand).
 * Body: { brand: "<slug>", week: {release, window, title, question, talkingPoints, facts, clips, hookNext, preparedAt} }.
 */
export async function POST(request: Request) {
  const auth = checkStatusToken(request.headers.get("authorization"));
  if (!auth.ok) {
    const message = auth.status === 503 ? "Showrunner status is not configured." : "Unauthorized.";
    return NextResponse.json({ error: message }, { status: auth.status });
  }
  if (!checkRateLimit("showrunner-weekly", 10, 60_000).allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { brand?: unknown; week?: unknown } | null;
  const slug = typeof body?.brand === "string" ? body.brand.trim() : "";
  const week = parseWeek(body?.week);
  if (!slug || !week) {
    return NextResponse.json({ error: "brand and a week with a release time are required." }, { status: 400 });
  }
  let brand;
  try {
    brand = await resolveBrand(slug);
  } catch (error) {
    if (error instanceof PipeBrandError) return NextResponse.json({ error: error.message }, { status: 404 });
    throw error;
  }
  const context = createBrandDataContext({ brandId: brand.id, actorUserId: auth.actorUserId });
  await withBrandDataTransaction(context, (tx) =>
    tx.showrunnerStudio.upsert({
      where: { brandId: brand.id },
      create: { brandId: brand.id, weekly: week },
      update: { weekly: week },
    }),
  );
  return NextResponse.json({ saved: week.release });
}

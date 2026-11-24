import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { checkScanToken } from "@/lib/scan/auth";
import { parseApplied } from "@/lib/scan/reviews";

export const dynamic = "force-dynamic";

/** Ripley reports which answers it applied: `{ results: [{ id, ok, result }] }`. */
export async function POST(request: Request) {
  const auth = checkScanToken(request.headers.get("authorization"));
  if (!auth.ok) {
    const message = auth.status === 503 ? "Scan is not configured." : "Unauthorized.";
    return NextResponse.json({ error: message }, { status: auth.status });
  }
  if (!checkRateLimit("scan-reviews-applied", 120, 60_000).allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { results?: unknown } | null;
  const results = parseApplied(body?.results);
  if (!results) return NextResponse.json({ error: "results must be [{ id, ok, result }]." }, { status: 400 });
  const now = new Date();
  let saved = 0;
  for (const row of results) {
    const done = await prisma.scanReviewItem.updateMany({
      where: { id: row.id, status: "answered" },
      data: { status: row.ok ? "applied" : "failed", appliedAt: now, result: row.result },
    });
    saved += done.count;
  }
  return NextResponse.json({ saved });
}

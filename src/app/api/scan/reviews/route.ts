import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { checkScanToken } from "@/lib/scan/auth";
import { REVIEW_KINDS, parseReviewList, syncReviewList } from "@/lib/scan/reviews";

export const dynamic = "force-dynamic";

function guard(request: Request, bucket: string): NextResponse | null {
  const auth = checkScanToken(request.headers.get("authorization"));
  if (!auth.ok) {
    const message = auth.status === 503 ? "Scan is not configured." : "Unauthorized.";
    return NextResponse.json({ error: message }, { status: auth.status });
  }
  if (!checkRateLimit(bucket, 120, 60_000).allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  return null;
}

/** Ripley's poller asks for Tom's answers that still need applying (every
 * poll; usually an empty list). */
export async function GET(request: Request) {
  const blocked = guard(request, "scan-reviews-answers");
  if (blocked) return blocked;
  const items = await prisma.scanReviewItem.findMany({
    where: { status: "answered" },
    orderBy: { answeredAt: "asc" },
    take: 500,
    select: { id: true, review: true, itemKey: true, answer: true },
  });
  return NextResponse.json({ items });
}

/** Ripley pushes what waits in each review: `{ lists: { spam: [...], newsletter: [...] } }`.
 * A list left out (or not an array) is not touched. */
export async function POST(request: Request) {
  const blocked = guard(request, "scan-reviews-push");
  if (blocked) return blocked;
  const body = (await request.json().catch(() => null)) as { lists?: Record<string, unknown> } | null;
  if (!body?.lists || typeof body.lists !== "object") {
    return NextResponse.json({ error: "lists is required." }, { status: 400 });
  }
  const synced: Record<string, { created: number; reopened: number; gone: number }> = {};
  for (const review of REVIEW_KINDS) {
    const items = parseReviewList(review, body.lists[review]);
    if (items) synced[review] = await syncReviewList(prisma, review, items);
  }
  return NextResponse.json({ synced });
}

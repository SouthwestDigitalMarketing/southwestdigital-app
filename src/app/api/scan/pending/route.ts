import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { checkScanToken } from "@/lib/scan/auth";

export const dynamic = "force-dynamic";

/** Ripley asks what to do: the oldest requested run, plus when the last run
 * finished (so the poller can fire the 15-minute auto scan itself). */
export async function GET(request: Request) {
  const auth = checkScanToken(request.headers.get("authorization"));
  if (!auth.ok) {
    const message = auth.status === 503 ? "Scan is not configured." : "Unauthorized.";
    return NextResponse.json({ error: message }, { status: auth.status });
  }
  if (!checkRateLimit("scan-pending", 120, 60_000).allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const [requested, lastDone] = await Promise.all([
    prisma.scanRun.findFirst({ where: { status: "requested" }, orderBy: { requestedAt: "asc" } }),
    prisma.scanRun.findFirst({ where: { status: "done" }, orderBy: { finishedAt: "desc" } }),
  ]);
  return NextResponse.json({
    requested: requested
      ? { id: requested.id, auto: requested.auto, requestedAt: requested.requestedAt.toISOString() }
      : null,
    lastFinishedAt: lastDone?.finishedAt?.toISOString() ?? null,
  });
}

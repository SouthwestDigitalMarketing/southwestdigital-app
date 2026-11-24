import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { checkScanToken } from "@/lib/scan/auth";
import { STALE_RUNNING_MS } from "@/lib/scan/scan";
import { initialSources } from "@/lib/scan/sources";

export const dynamic = "force-dynamic";

/** Ripley claims the oldest requested run (or starts an auto run) so only one
 * poller works it. The claim is atomic: two pollers cannot take the same run. */
export async function POST(request: Request) {
  const auth = checkScanToken(request.headers.get("authorization"));
  if (!auth.ok) {
    const message = auth.status === 503 ? "Scan is not configured." : "Unauthorized.";
    return NextResponse.json({ error: message }, { status: auth.status });
  }
  if (!checkRateLimit("scan-claim", 60, 60_000).allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { auto?: unknown } | null;
  const startedAt = new Date();
  // Reap running runs whose poller died mid-scan: they can never finish, and
  // one dead run pins the header spinner forever. Stale *requested* runs are
  // simply claimed below and run now — a late scan beats none.
  await prisma.scanRun.updateMany({
    where: { status: "running", startedAt: { lt: new Date(startedAt.getTime() - STALE_RUNNING_MS) } },
    data: { status: "error", error: "Superseded: no poller finished this run in time." },
  });

  if (body?.auto === true) {
    const lastDone = await prisma.scanRun.findFirst({ where: { status: "done" }, orderBy: { finishedAt: "desc" } });
    const run = await prisma.scanRun.create({
      data: { status: "running", auto: true, requestedBy: auth.actorUserId, startedAt, sources: initialSources() },
    });
    return NextResponse.json({
      runId: run.id,
      since: lastDone?.finishedAt?.toISOString() ?? null,
    });
  }

  const requested = await prisma.scanRun.findFirst({ where: { status: "requested" }, orderBy: { requestedAt: "asc" } });
  if (!requested) return NextResponse.json({ error: "No scan requested." }, { status: 404 });
  const claimed = await prisma.scanRun.updateMany({
    where: { id: requested.id, status: "requested" },
    data: { status: "running", startedAt },
  });
  if (claimed.count === 0) return NextResponse.json({ error: "Scan already claimed." }, { status: 409 });
  if (!requested.sources) {
    await prisma.scanRun.update({ where: { id: requested.id }, data: { sources: initialSources() } });
  }
  const lastDone = await prisma.scanRun.findFirst({ where: { status: "done" }, orderBy: { finishedAt: "desc" } });
  return NextResponse.json({ runId: requested.id, since: lastDone?.finishedAt?.toISOString() ?? null });
}

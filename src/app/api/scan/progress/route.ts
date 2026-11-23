import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { checkScanToken } from "@/lib/scan/auth";
import { initialSources, parseSourceProgress, type ScanSourceState } from "@/lib/scan/sources";

export const dynamic = "force-dynamic";

function readSources(raw: unknown): ScanSourceState[] {
  if (!Array.isArray(raw)) return initialSources();
  const rows = raw.filter(
    (row): row is ScanSourceState =>
      !!row && typeof row === "object" && typeof (row as { source?: unknown }).source === "string",
  );
  return rows.length > 0 ? rows : initialSources();
}

/** Ripley posts per-source live progress while a run is in flight; the modal
 * reads it back. Closing the modal never stops the run. */
export async function POST(request: Request) {
  const auth = checkScanToken(request.headers.get("authorization"));
  if (!auth.ok) {
    const message = auth.status === 503 ? "Scan is not configured." : "Unauthorized.";
    return NextResponse.json({ error: message }, { status: auth.status });
  }
  if (!checkRateLimit("scan-progress", 120, 60_000).allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const runId = typeof body?.runId === "string" ? body.runId : "";
  const progress = parseSourceProgress(body);
  if (!runId || !progress) return NextResponse.json({ error: "runId, source and status are required." }, { status: 400 });
  const run = await prisma.scanRun.findUnique({ where: { id: runId } });
  if (!run) return NextResponse.json({ error: "Scan run not found." }, { status: 404 });
  if (run.status !== "running") return NextResponse.json({ error: "Scan run is not running." }, { status: 409 });
  const sources = readSources(run.sources);
  const next = sources.some((row) => row.source === progress.source)
    ? sources.map((row) =>
        row.source === progress.source
          ? {
              ...row,
              status: progress.status,
              detail: progress.detail ?? row.detail,
              loginUrl: progress.loginUrl ?? row.loginUrl,
              loginLabel: progress.loginLabel ?? row.loginLabel,
            }
          : row,
      )
    : [...sources, { source: progress.source, label: progress.source, status: progress.status, detail: progress.detail }];
  await prisma.scanRun.update({ where: { id: run.id }, data: { sources: next } });
  return NextResponse.json({ saved: true });
}

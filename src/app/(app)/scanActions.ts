"use server";

import { prisma } from "@/lib/prisma";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { formatUpdatedAgo, type ScanChange } from "@/lib/scan/scan";

export type ScanStatus = {
  running: boolean;
  updatedAgo: string;
  changes: ScanChange[];
};

/** Tom presses Scan: record a requested run unless one is already waiting or running. */
export async function requestScan(): Promise<{ runId: string; alreadyRunning: boolean }> {
  const { session } = await requireStaffBrandOrThrow();
  const active = await prisma.scanRun.findFirst({
    where: { status: { in: ["requested", "running"] } },
    orderBy: { requestedAt: "desc" },
  });
  if (active) return { runId: active.id, alreadyRunning: true };
  const run = await prisma.scanRun.create({
    data: { status: "requested", requestedBy: session.user.id ?? session.user.email ?? "staff" },
  });
  return { runId: run.id, alreadyRunning: false };
}

/** Header status: whether a scan is in flight, when the last one landed, what changed. */
export async function getScanStatus(): Promise<ScanStatus> {
  await requireStaffBrandOrThrow();
  const [active, lastDone] = await Promise.all([
    prisma.scanRun.findFirst({
      where: { status: { in: ["requested", "running"] } },
      orderBy: { requestedAt: "desc" },
    }),
    prisma.scanRun.findFirst({ where: { status: "done" }, orderBy: { finishedAt: "desc" } }),
  ]);
  const changes = Array.isArray(lastDone?.changes) ? (lastDone.changes as ScanChange[]) : [];
  return {
    running: active !== null,
    updatedAgo: formatUpdatedAgo(lastDone?.finishedAt ?? null),
    changes: changes.slice(0, 10),
  };
}

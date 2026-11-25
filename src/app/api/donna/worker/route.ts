import { NextResponse } from "next/server";
import { z } from "zod";
import {
  workerContext,
  claimJob,
  publish,
  lockLease,
  enqueue,
} from "@/lib/donna/store";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import { checkRateLimit } from "@/lib/simpleRateLimit";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const auth = await workerContext(request.headers.get("authorization"));
  if ("error" in auth)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!checkRateLimit("donna-worker", 600, 60_000).allowed)
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.op !== "string")
    return NextResponse.json({ error: "Operation required." }, { status: 400 });
  try {
    if (body.op === "claim")
      return NextResponse.json({ work: await claimJob(auth.context) });
    if (body.op === "publish")
      return NextResponse.json(await publish(auth.context, body.packet));
    if (body.op === "notify") {
      const key = z.string().min(1).max(200).parse(body.eventKey);
      await withBrandDataTransaction(auth.context, async (tx) => {
        const boxes = await tx.donnaMailbox.findMany({
          where: { brandId: auth.context.brandId, key: "zoho", paused: false },
        });
        for (const box of boxes) {
          await enqueue(tx, box.id, "incoming", `idle:${key}`);
          await tx.donnaMailbox.update({
            where: { id: box.id },
            data: { lastNotifiedAt: new Date() },
          });
        }
      });
      return NextResponse.json({ ok: true });
    }
    if (body.op === "heartbeat") {
      await withBrandDataTransaction(auth.context, async (tx) => {
        await tx.donnaMailbox.updateMany({
          where: { brandId: auth.context.brandId, paused: false },
          data: { heartbeatAt: new Date() },
        });
        if (body.jobId && body.leaseToken) {
          await lockLease(tx, auth.context, body.jobId, body.leaseToken);
          await tx.donnaJob.update({
            where: { id: body.jobId },
            data: { leaseUntil: new Date(Date.now() + 600_000) },
          });
        }
        // Reconciliation is a recovery path and also observes manual Sent activity.
        const boxes = await tx.donnaMailbox.findMany({
          where: { brandId: auth.context.brandId, paused: false },
        });
        for (const box of boxes) {
          if (body.listener === "idle-inbox" || body.listener === "offline") {
            const coverage =
              box.coverage &&
              typeof box.coverage === "object" &&
              !Array.isArray(box.coverage)
                ? box.coverage
                : {};
            await tx.donnaMailbox.update({
              where: { id: box.id },
              data: {
                coverage: {
                  ...coverage,
                  idleInbox: body.listener === "idle-inbox",
                },
              },
            });
          }
          if (
            !box.lastCheckedAt ||
            Date.now() - box.lastCheckedAt.getTime() > 900_000
          )
            await enqueue(
              tx,
              box.id,
              "reconcile",
              `recovery:${Math.floor(Date.now() / 900_000)}`,
            );
        }
      });
      return NextResponse.json({ ok: true });
    }
    if (body.op === "complete" || body.op === "fail") {
      const input = z
        .object({
          jobId: z.string(),
          leaseToken: z.string(),
          error: z.string().max(1000).optional(),
          coverage: z.record(z.string(), z.unknown()).optional(),
        })
        .parse(body.result);
      await withBrandDataTransaction(auth.context, async (tx) => {
        const job = await lockLease(
          tx,
          auth.context,
          input.jobId,
          input.leaseToken,
        );
        if (body.op === "fail") {
          await tx.donnaJob.update({
            where: { id: job.id },
            data: {
              status: "pending",
              leaseToken: null,
              leaseUntil: null,
              error: input.error ?? "Worker could not finish.",
              nextAttemptAt: new Date(
                Date.now() +
                  Math.min(3600000, 30000 * 2 ** Math.min(job.attempts, 7)),
              ),
            },
          });
          await tx.donnaMailbox.update({
            where: { id: job.mailboxId },
            data: { lastError: input.error ?? "Worker could not finish." },
          });
          await tx.donnaActivity.createMany({
            skipDuplicates: true,
            data: [
              {
                mailboxId: job.mailboxId,
                eventKey: `failed:${job.id}:${job.attempts}`,
                kind: "failed",
                detail: input.error ?? "Worker could not finish.",
                evidence:
                  "Worker reported failure; the job remains pending for retry.",
                occurredAt: new Date(),
              },
            ],
          });
        } else {
          await tx.donnaJob.update({
            where: { id: job.id },
            data: {
              status: "done",
              completedAt: new Date(),
              leaseToken: null,
              leaseUntil: null,
            },
          });
          const box = await tx.donnaMailbox.findUniqueOrThrow({
            where: { id: job.mailboxId },
          });
          const previous =
            box.coverage &&
            typeof box.coverage === "object" &&
            !Array.isArray(box.coverage)
              ? (box.coverage as Record<string, unknown>)
              : {};
          const incoming = (input.coverage ?? {}) as Record<string, unknown>;
          const coverage = { ...previous, ...incoming };
          if (job.kind === "clean") {
            if (typeof previous.remaining_threads === "number")
              coverage.remaining_threads = previous.remaining_threads;
            if ("coverage_complete" in previous)
              coverage.coverage_complete = previous.coverage_complete;
          }
          await tx.donnaMailbox.update({
            where: { id: job.mailboxId },
            data: {
              lastCheckedAt: new Date(),
              heartbeatAt: new Date(),
              lastError:
                Number(coverage.deferred_threads ?? 0) > 0
                  ? `${Number(coverage.deferred_threads)} conversations could not be assessed; retries are queued.`
                  : null,
              coverage:
                coverage as import("@prisma/client").Prisma.InputJsonObject,
            },
          });
          if (
            job.kind !== "clean" &&
            !box.paused &&
            (Number(coverage.remaining_threads ?? 0) > 0 ||
              coverage.coverage_complete === false)
          ) {
            const next = await enqueue(
              tx,
              job.mailboxId,
              "backlog",
              `backlog:${job.id}`,
            );
            if (
              (Array.isArray(coverage.gaps) && coverage.gaps.length) ||
              (Number(coverage.deferred_threads ?? 0) > 0 &&
                Number(coverage.ready_threads ?? 0) === 0)
            )
              await tx.donnaJob.update({
                where: { id: next.id },
                data: { nextAttemptAt: new Date(Date.now() + 300_000) },
              });
          }
        }
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown operation." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? "Invalid worker payload."
            : "Job could not be updated; check its lease and mailbox.",
      },
      { status: error instanceof z.ZodError ? 400 : 409 },
    );
  }
}

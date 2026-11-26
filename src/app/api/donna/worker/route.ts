import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import {
  workerContext,
  claimJob,
  publish,
  lockLease,
  enqueue,
  AUTO_CLEAN_PREFIX,
} from "@/lib/donna/store";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import { checkRateLimit } from "@/lib/simpleRateLimit";

/** Mark undone (or failed) filed items on the clean job that filed them. */
async function recordUndo(
  tx: Prisma.TransactionClient,
  mailboxId: string,
  undo: {
    cleanJobId: string;
    undone: string[];
    failed: { thread: string; reason: string }[];
  },
) {
  const clean = await tx.donnaJob.findFirst({
    where: { id: undo.cleanJobId, mailboxId, kind: "clean" },
  });
  const result =
    clean?.result &&
    typeof clean.result === "object" &&
    !Array.isArray(clean.result)
      ? (clean.result as Record<string, unknown>)
      : null;
  if (!clean || !result || !Array.isArray(result.filed)) return;
  const done = new Set(undo.undone);
  const failed = new Map(undo.failed.map((f) => [f.thread, f.reason]));
  const filed = result.filed.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    const row = item as Record<string, unknown>;
    const thread = String(row.thread ?? "");
    if (done.has(thread))
      return { ...row, undone: true, undoPending: false, undoError: undefined };
    if (failed.has(thread))
      return { ...row, undoPending: false, undoError: failed.get(thread) };
    return row;
  });
  await tx.donnaJob.update({
    where: { id: clean.id },
    data: { result: { ...result, filed } as Prisma.InputJsonObject },
  });
  if (undo.undone.length)
    await tx.donnaActivity.create({
      data: {
        mailboxId,
        eventKey: `unfiled:${clean.id}:${randomUUID()}`,
        kind: "corrected",
        detail: `Moved ${undo.undone.length} back to Inbox`,
        evidence:
          "Verified IMAP copy back into Inbox, then removed from the filing folder.",
        occurredAt: new Date(),
      },
    });
}

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
          // New Inbox mail: Donna files what she can on her own (Tom, 2026-11-25).
          const queued = await tx.donnaJob.findFirst({
            where: {
              mailboxId: box.id,
              kind: "clean",
              status: "pending",
              eventKey: { startsWith: AUTO_CLEAN_PREFIX },
            },
          });
          if (!queued)
            await tx.donnaJob.create({
              data: {
                mailboxId: box.id,
                kind: "clean",
                eventKey: `${AUTO_CLEAN_PREFIX}${key}`,
                options: { auto: true },
              },
            });
          await tx.donnaMailbox.update({
            where: { id: box.id },
            data: { lastNotifiedAt: new Date() },
          });
        }
      });
      return NextResponse.json({ ok: true });
    }
    if (body.op === "heartbeat") {
      let cancelled = false;
      await withBrandDataTransaction(auth.context, async (tx) => {
        await tx.donnaMailbox.updateMany({
          where: { brandId: auth.context.brandId, paused: false },
          data: { heartbeatAt: new Date() },
        });
        if (body.jobId && body.leaseToken) {
          const job = await lockLease(
            tx,
            auth.context,
            body.jobId,
            body.leaseToken,
          );
          // Tom pressed Cancel: the worker stops before its next move and reports.
          cancelled = job.status === "cancelled";
          await tx.donnaJob.update({
            where: { id: body.jobId },
            data: { leaseUntil: new Date(Date.now() + 600_000) },
          });
          const progress = z
            .object({
              total: z.number().int().nonnegative().max(100_000),
              done: z.number().int().nonnegative().max(100_000),
              current: z.string().max(200).nullable().optional(),
              phase: z.string().max(40).optional(),
              startedAt: z.string().max(40).optional(),
            })
            .optional()
            .parse(body.progress);
          if (progress) {
            const box = await tx.donnaMailbox.findUnique({
              where: { id: job.mailboxId },
            });
            const coverage =
              box?.coverage &&
              typeof box.coverage === "object" &&
              !Array.isArray(box.coverage)
                ? (box.coverage as Record<string, unknown>)
                : {};
            const prior =
              coverage.cleanProgress &&
              typeof coverage.cleanProgress === "object" &&
              !Array.isArray(coverage.cleanProgress)
                ? (coverage.cleanProgress as Record<string, unknown>)
                : {};
            await tx.donnaMailbox.update({
              where: { id: job.mailboxId },
              data: {
                coverage: {
                  ...coverage,
                  cleanProgress: {
                    total: progress.total,
                    done: progress.done,
                    current: progress.current ?? null,
                    phase: progress.phase ?? "working",
                    startedAt: progress.startedAt ?? prior.startedAt ?? null,
                  },
                },
              },
            });
          }
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
      return NextResponse.json({ ok: true, cancelled });
    }
    if (body.op === "complete" || body.op === "fail") {
      const input = z
        .object({
          jobId: z.string(),
          leaseToken: z.string(),
          error: z.string().max(1000).optional(),
          coverage: z.record(z.string(), z.unknown()).optional(),
          report: z.record(z.string(), z.unknown()).optional(),
          cancelled: z.boolean().optional(),
          undo: z
            .object({
              cleanJobId: z.string().max(100),
              undone: z.array(z.string().max(100)).max(200),
              failed: z
                .array(
                  z.object({
                    thread: z.string().max(100),
                    reason: z.string().max(200),
                  }),
                )
                .max(200),
            })
            .optional(),
        })
        .parse(body.result);
      await withBrandDataTransaction(auth.context, async (tx) => {
        const job = await lockLease(
          tx,
          auth.context,
          input.jobId,
          input.leaseToken,
        );
        if (body.op === "fail" && job.status === "cancelled") {
          // Cancelled stays cancelled; never requeue a job Tom stopped.
          await tx.donnaJob.update({
            where: { id: job.id },
            data: { leaseToken: null, leaseUntil: null },
          });
        } else if (body.op === "fail") {
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
        } else if (job.kind === "undo") {
          await tx.donnaJob.update({
            where: { id: job.id },
            data: {
              status: "done",
              completedAt: new Date(),
              leaseToken: null,
              leaseUntil: null,
              result: (input.undo ?? {}) as Prisma.InputJsonObject,
            },
          });
          if (input.undo) await recordUndo(tx, job.mailboxId, input.undo);
        } else {
          const stopped =
            job.status === "cancelled" || input.cancelled === true;
          await tx.donnaJob.update({
            where: { id: job.id },
            data: {
              status: stopped ? "cancelled" : "done",
              completedAt: new Date(),
              leaseToken: null,
              leaseUntil: null,
              ...(job.kind === "clean" && input.report
                ? {
                    result: {
                      ...input.report,
                      cancelled: stopped,
                    } as Prisma.InputJsonObject,
                  }
                : {}),
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
              lastError: null,
              coverage: coverage as Prisma.InputJsonObject,
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

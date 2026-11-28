import "server-only";
import { Prisma } from "@prisma/client";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  createBrandDataContext,
  withBrandDataTransaction,
  type BrandDataContext,
} from "@/lib/tenancy/context";
import {
  activityCounts,
  cleanIsCleanup,
  cleanIsDo,
  cleanIsSort,
  jobEnd,
  sortAwaitsTom,
  donnaActionCounts,
  donnaSettings,
  requestSchema,
  activitySchema,
} from "./domain";
import { z } from "zod";

/**
 * Event-key prefix of cleans queued by new mail. They run quietly; the bar is
 * for cleans Tom starts. (A JSON-path NOT filter would also drop jobs whose
 * options lack the key, so this keys on the non-null eventKey instead.)
 */
export const AUTO_CLEAN_PREFIX = "idle:";

export function storageMissing(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
}
export async function workerContext(header: string | null) {
  const wanted = process.env.DONNA_WORKER_TOKEN ?? "";
  const given = header?.match(/^Bearer (\S+)$/)?.[1] ?? "";
  if (wanted.length < 32 || !process.env.DONNA_WORKER_USER_ID)
    return { error: "Donna worker is not configured.", status: 503 } as const;
  const a = createHash("sha256").update(wanted).digest();
  const b = createHash("sha256").update(given).digest();
  if (!given || !timingSafeEqual(a, b))
    return { error: "Unauthorized.", status: 401 } as const;
  const brand = await prisma.brand.findUnique({
    where: { slug: process.env.DONNA_WORKER_BRAND ?? "bookkeeping-conroe" },
  });
  if (!brand || brand.status !== "ACTIVE" || brand.deletedAt)
    return { error: "Mailbox brand is unavailable.", status: 403 } as const;
  return {
    context: createBrandDataContext({
      brandId: brand.id,
      actorUserId: process.env.DONNA_WORKER_USER_ID,
    }),
  };
}

export async function enqueue(
  tx: Prisma.TransactionClient,
  mailboxId: string,
  kind: string,
  eventKey: string,
) {
  return tx.donnaJob.upsert({
    where: { mailboxId_eventKey: { mailboxId, eventKey } },
    create: { mailboxId, kind, eventKey },
    update: {},
  });
}

export async function loadDonnaAction(context: BrandDataContext) {
  return withBrandDataTransaction(context, async (tx) => {
    const mailbox = await tx.donnaMailbox.findFirst({
      where: { brandId: context.brandId },
      orderBy: { address: "asc" },
      select: { id: true, coverage: true },
    });
    if (!mailbox)
      return {
        mailboxId: null as string | null,
        cleaning: false,
        cleanJobId: null as string | null,
        counts: donnaActionCounts({}),
      };
    const cleaning = await tx.donnaJob.findFirst({
      where: {
        mailboxId: mailbox.id,
        kind: "clean",
        status: { in: ["pending", "leased"] },
        NOT: { eventKey: { startsWith: AUTO_CLEAN_PREFIX } },
      },
      select: { id: true },
    });
    return {
      mailboxId: mailbox.id,
      cleaning: Boolean(cleaning),
      cleanJobId: cleaning?.id ?? null,
      counts: donnaActionCounts(mailbox.coverage),
    };
  });
}

export async function loadActiveClean(context: BrandDataContext) {
  return withBrandDataTransaction(context, async (tx) =>
    tx.donnaJob.findFirst({
      where: {
        mailbox: { brandId: context.brandId },
        kind: "clean",
        status: { in: ["pending", "leased"] },
        // Cleans started by new mail run quietly; the bar is for ones Tom starts.
        NOT: { eventKey: { startsWith: AUTO_CLEAN_PREFIX } },
      },
      orderBy: { receivedAt: "desc" },
      select: {
        id: true,
        status: true,
        options: true,
        mailbox: {
          select: { id: true, coverage: true, paused: true, heartbeatAt: true },
        },
      },
    }),
  );
}

export async function loadClean(context: BrandDataContext, id: string) {
  return withBrandDataTransaction(context, async (tx) => {
    const job = await tx.donnaJob.findFirst({
      where: {
        id,
        kind: "clean",
        mailbox: { brandId: context.brandId },
      },
      include: {
        mailbox: {
          select: {
            id: true,
            address: true,
            coverage: true,
            paused: true,
            heartbeatAt: true,
          },
        },
      },
    });
    if (!job) return null;
    // A step 3 or step 4 page belongs to its Inbox job: the sort it came from.
    const from = (job.options as { previewJobId?: unknown } | null)
      ?.previewJobId;
    const parent =
      typeof from === "string"
        ? await tx.donnaJob.findFirst({
            where: { id: from, mailboxId: job.mailboxId },
            select: {
              id: true,
              number: true,
              status: true,
              options: true,
              result: true,
            },
          })
        : null;
    const sortId = parent?.id ?? job.id;
    // The sort's later steps: step 3 (Do) and step 4 (Clean up), if started.
    const later = await tx.donnaJob.findMany({
      where: {
        mailboxId: job.mailboxId,
        kind: "clean",
        options: { path: ["previewJobId"], equals: sortId },
      },
      orderBy: { receivedAt: "desc" },
      select: {
        id: true,
        status: true,
        options: true,
        result: true,
        completedAt: true,
      },
    });
    const approved = later.find((j) => !cleanIsCleanup(j.options)) ?? null;
    const cleanupJob = later.find((j) => cleanIsCleanup(j.options)) ?? null;
    return {
      ...job,
      approvedJobId: approved?.id ?? null,
      follow: approved,
      cleanupJob,
      parent,
      jobNumber: parent?.number ?? job.number,
    };
  });
}

/** Everything the Overview needs to show what Donna is doing and let Tom steer her. */
export async function loadStatus(context: BrandDataContext, since: Date) {
  return withBrandDataTransaction(context, async (tx) => {
    const mailbox = await tx.donnaMailbox.findFirst({
      where: { brandId: context.brandId },
      orderBy: { address: "asc" },
    });
    if (!mailbox) return null;
    const [active, queued, filedToday, needsYou, recent] = await Promise.all([
      tx.donnaJob.findFirst({
        where: {
          mailboxId: mailbox.id,
          status: "leased",
          leaseUntil: { gt: new Date() },
        },
        select: {
          id: true,
          kind: true,
          status: true,
          options: true,
          eventKey: true,
        },
      }),
      tx.donnaJob.groupBy({
        by: ["kind"],
        where: { mailboxId: mailbox.id, status: "pending" },
        _count: { _all: true },
      }),
      tx.donnaActivity.count({
        where: {
          mailboxId: mailbox.id,
          kind: "filed",
          occurredAt: { gte: since },
        },
      }),
      tx.donnaRequest.count({
        where: { mailboxId: mailbox.id, state: "needs-you" },
      }),
      tx.donnaActivity.findMany({
        where: {
          mailboxId: mailbox.id,
          kind: {
            in: ["filed", "corrected", "failed", "control", "draft-ready"],
          },
        },
        orderBy: { occurredAt: "desc" },
        take: 12,
        select: {
          id: true,
          kind: true,
          detail: true,
          occurredAt: true,
          request: { select: { id: true, title: true } },
        },
      }),
    ]);
    return { mailbox, active, queued, filedToday, needsYou, recent };
  });
}

/** Completed jobs tab: every finished or stopped clean, step and undo, newest first. */
const JOB_ROW = {
  id: true,
  number: true,
  kind: true,
  status: true,
  options: true,
  result: true,
  eventKey: true,
  error: true,
  receivedAt: true,
  completedAt: true,
} as const;

/**
 * Every job, newest first, a stepped job as one row (its sort, with step 3 folded in).
 * The Jobs in progress and Completed jobs tabs split these by how the job ended.
 */
async function loadJobRows(context: BrandDataContext, take: number) {
  return withBrandDataTransaction(context, async (tx) => {
    const rows = await tx.donnaJob.findMany({
      where: {
        mailbox: { brandId: context.brandId },
        kind: { in: ["clean", "undo"] },
      },
      orderBy: { receivedAt: "desc" },
      take: take * 2,
      select: JOB_ROW,
    });
    const follows = await tx.donnaJob.findMany({
      where: {
        mailbox: { brandId: context.brandId },
        kind: "clean",
        // Step 3 jobs carry buckets: true; step 4 jobs carry cleanup: true.
        OR: [
          { options: { path: ["buckets"], equals: true } },
          { options: { path: ["cleanup"], equals: true } },
        ],
      },
      select: JOB_ROW,
    });
    const linked = (keep: (options: unknown) => boolean) =>
      new Map(
        follows.flatMap((f) => {
          const from = (f.options as { previewJobId?: unknown } | null)
            ?.previewJobId;
          return typeof from === "string" && keep(f.options)
            ? [[from, f] as const]
            : [];
        }),
      );
    const doJobs = linked(cleanIsDo);
    const cleanups = linked(cleanIsCleanup);
    return rows
      .filter(
        (job) =>
          !cleanIsDo(job.options) &&
          !cleanIsCleanup(job.options) &&
          // Discarded by Tom: off both lists (Tom, 2026-11-28).
          (job.options as { discarded?: unknown } | null)?.discarded !== true,
      )
      .map((job) => ({
        ...job,
        follow: doJobs.get(job.id) ?? null,
        cleanup: cleanups.get(job.id) ?? null,
      }));
  });
}

export type JobRow = Awaited<ReturnType<typeof loadJobRows>>[number];

/** Completed jobs tab: only jobs that ran to the end (Tom, 2026-11-26). */
export async function loadJobs(context: BrandDataContext, take = 100) {
  const rows = await loadJobRows(context, take);
  return rows
    .filter((job) => jobEnd(job, job.follow, job.cleanup).label === "Finished")
    .slice(0, take);
}

/** Jobs in progress tab: running, waiting for Tom, stopped or closed part-way. */
export async function loadJobsInProgress(
  context: BrandDataContext,
  take = 100,
) {
  const rows = await loadJobRows(context, take);
  return rows
    .filter((job) => jobEnd(job, job.follow, job.cleanup).label !== "Finished")
    .slice(0, take);
}

/** The newest sort that finished and still waits for Tom to choose (step 2), if any. */
export async function loadAwaitingSort(context: BrandDataContext) {
  return withBrandDataTransaction(context, async (tx) => {
    const sorts = await tx.donnaJob.findMany({
      where: {
        mailbox: { brandId: context.brandId },
        kind: "clean",
        status: { in: ["done", "cancelled"] },
        options: { path: ["buckets"], equals: true },
      },
      orderBy: { receivedAt: "desc" },
      take: 5,
      select: JOB_ROW,
    });
    for (const sort of sorts) {
      if (!cleanIsSort(sort.options)) continue;
      const later = await tx.donnaJob.findMany({
        where: {
          kind: "clean",
          options: { path: ["previewJobId"], equals: sort.id },
        },
        select: { id: true, options: true },
      });
      const follow = later.find((j) => !cleanIsCleanup(j.options));
      const cleanup = later.find((j) => cleanIsCleanup(j.options));
      if (sortAwaitsTom(sort, follow, cleanup)) return sort;
    }
    return null;
  });
}

export async function loadDesk(
  context: BrandDataContext,
  state: string,
  page = 1,
  pageSize = 2,
) {
  return withBrandDataTransaction(context, async (tx) => {
    const scope = { mailbox: { brandId: context.brandId } };
    const [mailboxes, groups, rows, cleaning, cleans] = await Promise.all([
      tx.donnaMailbox.findMany({
        where: { brandId: context.brandId },
        orderBy: { address: "asc" },
      }),
      tx.donnaRequest.groupBy({
        by: ["state"],
        where: scope,
        _count: { _all: true },
      }),
      tx.donnaRequest.findMany({
        where: { ...scope, state },
        orderBy: [{ urgent: "desc" }, { updatedAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { mailbox: { select: { address: true } } },
      }),
      tx.donnaJob.findMany({
        where: {
          mailbox: { brandId: context.brandId },
          kind: "clean",
          status: { in: ["pending", "leased"] },
          NOT: { eventKey: { startsWith: AUTO_CLEAN_PREFIX } },
        },
        select: { mailboxId: true },
      }),
      tx.donnaJob.findMany({
        where: {
          mailbox: { brandId: context.brandId },
          kind: "clean",
          status: { in: ["done", "cancelled"] },
        },
        orderBy: { completedAt: "desc" },
        take: 50,
        select: { id: true, completedAt: true, result: true },
      }),
    ]);
    return {
      mailboxes,
      groups,
      rows,
      cleaning: cleaning.map((job) => job.mailboxId),
      cleans,
    };
  });
}

export async function claimJob(context: BrandDataContext) {
  return withBrandDataTransaction(context, async (tx) => {
    // A mailbox lock serializes workers, including leases reclaimed after a crash.
    const candidates = await tx.$queryRaw<{ id: string }[]>`
      SELECT m.id FROM "DonnaMailbox" m WHERE m."brandId" = ${context.brandId}
      AND NOT EXISTS (SELECT 1 FROM "DonnaJob" j WHERE j."mailboxId"=m.id
        AND j.status='leased' AND j."leaseUntil">now())
      AND NOT m.paused
      AND EXISTS (SELECT 1 FROM "DonnaJob" j WHERE j."mailboxId"=m.id
        AND j.status IN ('pending','leased')
        AND (j.kind = 'undo'
          OR (j.kind = 'clean' AND (j."eventKey" NOT LIKE 'idle:%'
            OR NOT COALESCE((m.settings->>'steps')::boolean, true)))
          OR (NOT COALESCE((m.settings->>'steps')::boolean, true)
            AND COALESCE((m.settings->>'history')::boolean, true)))
        AND j."nextAttemptAt"<=now() AND (j."leaseUntil" IS NULL OR j."leaseUntil"<=now()))
      ORDER BY m."createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED`;
    if (!candidates[0]) return null;
    const mailbox = await tx.donnaMailbox.findUniqueOrThrow({
      where: { id: candidates[0].id },
    });
    const ready = {
      mailboxId: mailbox.id,
      status: { in: ["pending", "leased"] },
      nextAttemptAt: { lte: new Date() },
      OR: [{ leaseUntil: null }, { leaseUntil: { lte: new Date() } }],
    };
    // Inbox cleans (Tom's, undo, and new mail) go ahead of background history passes.
    // In steps (Tom, 2026-11-26) only the steps Tom started, and his undos, run.
    const settings = donnaSettings(mailbox.settings);
    const job =
      (await tx.donnaJob.findFirst({
        where: {
          ...ready,
          kind: { in: ["clean", "undo"] },
          ...(settings.steps
            ? { NOT: { eventKey: { startsWith: AUTO_CLEAN_PREFIX } } }
            : {}),
        },
        orderBy: { receivedAt: "asc" },
      })) ??
      (settings.history && !settings.steps
        ? await tx.donnaJob.findFirst({
            where: ready,
            orderBy: { receivedAt: "asc" },
          })
        : null);
    if (!job) return null;
    const lease = await tx.donnaJob.update({
      where: { id: job.id },
      data: {
        status: "leased",
        leaseToken: randomUUID(),
        leaseUntil: new Date(Date.now() + 600_000),
        attempts: { increment: 1 },
        error: null,
      },
    });
    return {
      job: lease,
      mailbox: { id: mailbox.id, key: mailbox.key, address: mailbox.address },
      settings: donnaSettings(mailbox.settings),
      contacts: await tx.contact.findMany({
        where: { brandId: context.brandId, isActive: true },
        select: {
          id: true,
          name: true,
          company: true,
          email: true,
          secondaryEmail: true,
          businessEmail: true,
          personalEmail: true,
          _count: { select: { serviceRecords: true } },
        },
      }),
      requests: await tx.donnaRequest.findMany({
        where: { mailboxId: mailbox.id },
        select: {
          sourceKey: true,
          title: true,
          state: true,
          direction: true,
          version: true,
          sourceVersion: true,
          completionNote: true,
        },
      }),
    };
  });
}

const packet = z
  .object({
    jobId: z.string(),
    leaseToken: z.string(),
    requests: z.array(requestSchema).max(100),
    activities: z.array(activitySchema).max(500),
  })
  .strict();

export async function publish(context: BrandDataContext, raw: unknown) {
  const input = packet.parse(raw);
  return withBrandDataTransaction(context, async (tx) => {
    const job = await lockLease(tx, context, input.jobId, input.leaseToken);
    const ids = new Map<string, string>();
    for (const request of input.requests) {
      const old = await tx.donnaRequest.findUnique({
        where: {
          mailboxId_sourceKey: {
            mailboxId: job.mailboxId,
            sourceKey: request.sourceKey,
          },
        },
      });
      if (old?.sourceVersion === request.sourceVersion) {
        ids.set(request.sourceKey, old.id);
        continue;
      }
      if (old && request.baseVersion !== old.version)
        throw new Error("The request changed while it was being reviewed.");
      const { baseVersion: _baseVersion, ...fields } = request;
      const data = {
        ...fields,
        draft: request.draft ?? Prisma.DbNull,
        firstReceivedAt: new Date(request.firstReceivedAt),
        dueAt: request.dueAt ? new Date(request.dueAt) : null,
        followUpAt: request.followUpAt ? new Date(request.followUpAt) : null,
        answeredAt: request.answeredAt
          ? new Date(request.answeredAt)
          : (old?.answeredAt ?? null),
        completedAt: request.state === "handled" ? new Date() : null,
      };
      const edited = old?.draftEdited && old.draft;
      const saved = await tx.donnaRequest.upsert({
        where: {
          mailboxId_sourceKey: {
            mailboxId: job.mailboxId,
            sourceKey: request.sourceKey,
          },
        },
        create: { ...data, mailboxId: job.mailboxId },
        update: {
          ...data,
          version: { increment: 1 },
          ...(edited
            ? {
                draft: old.draft as Prisma.InputJsonValue,
                draftStale: true,
                state: "needs-you",
                nextAction:
                  "New mail arrived. Review your saved reply against the latest conversation.",
              }
            : {}),
        },
      });
      ids.set(request.sourceKey, saved.id);
      const kind = !old
        ? "request-opened"
        : old.state === "handled" && saved.state !== "handled"
          ? "reopened"
          : null;
      if (kind)
        await tx.donnaActivity.createMany({
          skipDuplicates: true,
          data: [
            {
              mailboxId: job.mailboxId,
              requestId: saved.id,
              eventKey: `${kind}:${saved.id}:${saved.version}`,
              kind,
              detail: saved.title,
              evidence: request.summary,
              occurredAt: new Date(),
            },
          ],
        });
    }
    for (const activity of input.activities) {
      await tx.donnaActivity.createMany({
        skipDuplicates: true,
        data: [
          {
            ...activity,
            mailboxId: job.mailboxId,
            requestId: ids.get(activity.metadata.requestKey) ?? null,
            occurredAt: new Date(activity.occurredAt),
          },
        ],
      });
    }
    return { published: input.requests.length };
  });
}

export async function lockLease(
  tx: Prisma.TransactionClient,
  context: BrandDataContext,
  id: string,
  token: string,
) {
  const rows = await tx.$queryRaw<
    { id: string }[]
  >`SELECT j.id FROM "DonnaJob" j
    JOIN "DonnaMailbox" m ON m.id=j."mailboxId"
    WHERE j.id=${id} AND j."leaseToken"=${token}
    AND j.status IN ('leased','cancelled')
    AND j."leaseUntil">now() AND m."brandId"=${context.brandId}
    AND NOT m.paused FOR UPDATE OF j, m`;
  if (!rows.length)
    throw new Error("Lease expired or mailbox unavailable; reacquire the job.");
  return tx.donnaJob.findUniqueOrThrow({ where: { id } });
}

export async function loadActivity(
  context: BrandDataContext,
  start: Date,
  end: Date,
  kind?: string,
  page = 1,
  pageSize = 2,
) {
  return withBrandDataTransaction(context, async (tx) => {
    const where = {
      mailbox: { brandId: context.brandId },
      occurredAt: { gte: start, lt: end },
    };
    const rows = await tx.donnaActivity.findMany({
      where,
      select: { kind: true, messageKey: true, requestId: true, eventKey: true },
    });
    const recent = await tx.donnaActivity.findMany({
      where: { ...where, ...(kind ? { kind } : {}) },
      orderBy: { occurredAt: "desc" },
      take: pageSize,
      skip: (page - 1) * pageSize,
      include: { request: { select: { id: true, title: true } } },
    });
    const total = await tx.donnaActivity.count({
      where: { ...where, ...(kind ? { kind } : {}) },
    });
    return { counts: activityCounts(rows), recent, total };
  });
}

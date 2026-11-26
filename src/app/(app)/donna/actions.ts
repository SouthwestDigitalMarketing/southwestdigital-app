"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireDonna } from "@/lib/donna/access";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import { AUTO_CLEAN_PREFIX, enqueue } from "@/lib/donna/store";
import {
  cleanReport,
  donnaActionCounts,
  donnaSettings,
  draftSchema,
} from "@/lib/donna/domain";
import { firmInstant } from "@/lib/operations/schedule";

function refresh() {
  revalidatePath("/", "layout");
  revalidatePath("/donna", "layout");
  revalidatePath("/dashboard");
}

export async function addMailbox(form: FormData) {
  const { dataContext } = await requireDonna();
  const address = z.email().parse(form.get("address"));
  await withBrandDataTransaction(dataContext, async (tx) => {
    // The first release deliberately connects only Mailroom's existing Zoho account.
    await tx.donnaMailbox.upsert({
      where: { brandId_key: { brandId: dataContext.brandId, key: "zoho" } },
      create: {
        brandId: dataContext.brandId,
        key: "zoho",
        address,
        hookKey: randomBytes(32).toString("hex"),
      },
      update: {},
    });
  });
  refresh();
}

export async function mailboxAction(form: FormData) {
  const { dataContext, session } = await requireDonna();
  const id = z.string().min(1).parse(form.get("mailboxId"));
  const action = z
    .enum(["check", "pause", "resume", "setup"])
    .parse(form.get("action"));
  await withBrandDataTransaction(dataContext, async (tx) => {
    const box = await tx.donnaMailbox.findFirstOrThrow({
      where: { id, brandId: dataContext.brandId },
    });
    if (action === "check")
      await enqueue(tx, id, "reconcile", `manual:${randomUUID()}`);
    if (action === "pause" || action === "resume") {
      await tx.donnaMailbox.update({
        where: { id },
        data: { paused: action === "pause" },
      });
      if (action === "pause")
        await tx.donnaJob.updateMany({
          where: { mailboxId: id, status: "leased" },
          data: { status: "pending", leaseToken: null, leaseUntil: null },
        });
      if (action === "resume")
        await enqueue(tx, id, "reconcile", `resume:${randomUUID()}`);
    }
    if (action === "setup")
      await tx.donnaMailbox.update({
        where: { id: box.id },
        data: {
          hookKey: randomBytes(32).toString("hex"),
          hookSecret: null,
          setupExpiresAt: new Date(Date.now() + 600_000),
        },
      });
    await tx.donnaActivity.create({
      data: {
        mailboxId: id,
        eventKey: `control:${randomUUID()}`,
        kind: "control",
        detail:
          action === "setup"
            ? "Webhook enrollment opened for ten minutes."
            : `Mailbox ${action} requested.`,
        actor: session.user.id,
        evidence: "Authenticated operator action",
        occurredAt: new Date(),
      },
    });
  });
  refresh();
}

export async function startCleanInbox(
  form: FormData,
): Promise<{ ok: boolean; message: string; jobId?: string }> {
  try {
    const { dataContext, session } = await requireDonna();
    const id = z.string().min(1).parse(form.get("mailboxId"));
    const jobId = await withBrandDataTransaction(dataContext, async (tx) => {
      const box = await tx.donnaMailbox.findFirstOrThrow({
        where: { id, brandId: dataContext.brandId },
      });
      if (box.paused) return null;
      const existing = await tx.donnaJob.findFirst({
        where: {
          mailboxId: box.id,
          kind: "clean",
          status: { in: ["pending", "leased"] },
          NOT: { eventKey: { startsWith: AUTO_CLEAN_PREFIX } },
        },
      });
      // Donna files allowlisted Inbox mail on her own; every move can be undone.
      const job =
        existing ??
        (await tx.donnaJob.create({
          data: {
            mailboxId: box.id,
            kind: "clean",
            eventKey: `clean:${randomUUID()}`,
            options: { manual: true },
          },
        }));
      if (!existing)
        await resetCleanProgress(
          tx,
          box,
          donnaActionCounts(box.coverage).inbox,
        );
      await tx.donnaActivity.create({
        data: {
          mailboxId: box.id,
          eventKey: `control:${randomUUID()}`,
          kind: "control",
          detail: existing
            ? "Inbox clean already in progress."
            : "Inbox clean requested.",
          actor: session.user.id,
          evidence: "Authenticated operator action",
          occurredAt: new Date(),
        },
      });
      return job.id;
    });
    if (!jobId)
      return {
        ok: false,
        message: "Donna is paused. Resume her in Settings to clean the inbox.",
      };
    refresh();
    return { ok: true, message: "Cleaning inbox.", jobId };
  } catch {
    return {
      ok: false,
      message: "Could not start Clean. Reload and try again.",
    };
  }
}

/** Clean inbox from a plain form (the Overview); same as the Donna modal button. */
export async function cleanInboxNow(form: FormData) {
  await startCleanInbox(form);
}

/** Tom's limits and the history on/off switch; the worker picks them up within half a minute. */
export async function updateDonnaSettings(form: FormData) {
  const { dataContext, session } = await requireDonna();
  const id = z.string().min(1).parse(form.get("mailboxId"));
  const input = z
    .object({
      dailyReviews: z.coerce.number().int().min(0).max(2000).optional(),
      historyReviews: z.coerce.number().int().min(0).max(2000).optional(),
      history: z.enum(["on", "off"]).optional(),
    })
    .parse({
      dailyReviews: form.get("dailyReviews") ?? undefined,
      historyReviews: form.get("historyReviews") ?? undefined,
      history: form.get("history") ?? undefined,
    });
  await withBrandDataTransaction(dataContext, async (tx) => {
    const box = await tx.donnaMailbox.findFirstOrThrow({
      where: { id, brandId: dataContext.brandId },
    });
    const next = {
      ...donnaSettings(box.settings),
      ...(input.dailyReviews !== undefined
        ? { dailyReviews: input.dailyReviews }
        : {}),
      ...(input.historyReviews !== undefined
        ? { historyReviews: input.historyReviews }
        : {}),
      ...(input.history ? { history: input.history === "on" } : {}),
    };
    await tx.donnaMailbox.update({
      where: { id: box.id },
      data: { settings: next },
    });
    await cleanControl(
      tx,
      box.id,
      session.user.id,
      `Settings: ${next.dailyReviews} reviews a day, history ${next.history ? `on (up to ${next.historyReviews})` : "off"}.`,
    );
  });
  refresh();
}

async function resetCleanProgress(
  tx: Prisma.TransactionClient,
  box: { id: string; coverage: Prisma.JsonValue },
  total: number,
) {
  const coverage =
    box.coverage &&
    typeof box.coverage === "object" &&
    !Array.isArray(box.coverage)
      ? (box.coverage as Record<string, unknown>)
      : {};
  await tx.donnaMailbox.update({
    where: { id: box.id },
    data: {
      coverage: {
        ...coverage,
        cleanProgress: {
          total,
          done: 0,
          current: null,
          phase: "queued",
          startedAt: new Date().toISOString(),
        },
      } as Prisma.InputJsonObject,
    },
  });
}

async function cleanControl(
  tx: Prisma.TransactionClient,
  mailboxId: string,
  actor: string,
  detail: string,
) {
  await tx.donnaActivity.create({
    data: {
      mailboxId,
      eventKey: `control:${randomUUID()}`,
      kind: "control",
      detail,
      actor,
      evidence: "Authenticated operator action",
      occurredAt: new Date(),
    },
  });
}

/** File the preview's emails Tom left ticked. The plan comes from the stored preview, not the form. */
export async function approveClean(form: FormData) {
  const { dataContext, session } = await requireDonna();
  const previewId = z.string().min(1).parse(form.get("jobId"));
  const chosen = new Set(form.getAll("thread").map(String));
  const jobId = await withBrandDataTransaction(dataContext, async (tx) => {
    const preview = await tx.donnaJob.findFirst({
      where: {
        id: previewId,
        kind: "clean",
        status: "done",
        mailbox: { brandId: dataContext.brandId },
      },
      include: { mailbox: true },
    });
    const report = cleanReport(preview?.result);
    if (!preview || !report?.preview || preview.mailbox.paused) return null;
    const busy = await tx.donnaJob.findFirst({
      where: {
        mailboxId: preview.mailboxId,
        kind: "clean",
        status: { in: ["pending", "leased"] },
      },
    });
    if (busy) return busy.id;
    const plan = report.filed
      .filter((item) => item.thread && chosen.has(item.thread))
      .map((item) => ({ thread: item.thread!, folder: item.folder ?? "" }));
    if (!plan.length) return null;
    const job = await tx.donnaJob.create({
      data: {
        mailboxId: preview.mailboxId,
        kind: "clean",
        eventKey: `clean:${randomUUID()}`,
        options: { previewJobId: preview.id, plan },
      },
    });
    await resetCleanProgress(tx, preview.mailbox, plan.length);
    await cleanControl(
      tx,
      preview.mailboxId,
      session.user.id,
      `Inbox clean approved: file ${plan.length}.`,
    );
    return job.id;
  });
  refresh();
  redirect(`/donna/cleans/${encodeURIComponent(jobId ?? previewId)}`);
}

/** Stop a clean. A running worker finishes the move in hand, then reports what it filed. */
export async function cancelClean(form: FormData) {
  const { dataContext, session } = await requireDonna();
  const id = z.string().min(1).parse(form.get("jobId"));
  await withBrandDataTransaction(dataContext, async (tx) => {
    const job = await tx.donnaJob.findFirst({
      where: {
        id,
        kind: "clean",
        status: { in: ["pending", "leased"] },
        mailbox: { brandId: dataContext.brandId },
      },
    });
    if (!job) return;
    const running = job.status === "leased" && job.leaseToken;
    await tx.donnaJob.update({
      where: { id: job.id },
      data: running
        ? { status: "cancelled" }
        : {
            status: "cancelled",
            completedAt: new Date(),
            leaseToken: null,
            leaseUntil: null,
          },
    });
    await cleanControl(
      tx,
      job.mailboxId,
      session.user.id,
      "Inbox clean cancelled.",
    );
  });
  refresh();
}

/** Put filed mail back in Inbox: one conversation, or every one still filed. */
export async function undoFiled(form: FormData) {
  const { dataContext, session } = await requireDonna();
  const id = z.string().min(1).parse(form.get("jobId"));
  const which = z.string().min(1).max(100).parse(form.get("thread"));
  await withBrandDataTransaction(dataContext, async (tx) => {
    const clean = await tx.donnaJob.findFirst({
      where: {
        id,
        kind: "clean",
        status: { in: ["done", "cancelled"] },
        mailbox: { brandId: dataContext.brandId },
      },
      include: { mailbox: { select: { paused: true } } },
    });
    const result =
      clean?.result &&
      typeof clean.result === "object" &&
      !Array.isArray(clean.result)
        ? (clean.result as Record<string, unknown>)
        : null;
    const report = cleanReport(result);
    if (!clean || !result || !report || report.preview || clean.mailbox.paused)
      return;
    const threads = report.filed
      .filter(
        (item) =>
          item.thread &&
          !item.undone &&
          !item.undoPending &&
          (which === "all" || item.thread === which),
      )
      .map((item) => item.thread!);
    if (!threads.length) return;
    await tx.donnaJob.create({
      data: {
        mailboxId: clean.mailboxId,
        kind: "undo",
        eventKey: `undo:${randomUUID()}`,
        options: { cleanJobId: clean.id, threads },
      },
    });
    const pending = new Set(threads);
    const filed = (Array.isArray(result.filed) ? result.filed : []).map(
      (item) =>
        item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        pending.has(String((item as Record<string, unknown>).thread))
          ? {
              ...(item as Record<string, unknown>),
              undoPending: true,
              undoError: null,
            }
          : item,
    );
    await tx.donnaJob.update({
      where: { id: clean.id },
      data: { result: { ...result, filed } as Prisma.InputJsonObject },
    });
    await cleanControl(
      tx,
      clean.mailboxId,
      session.user.id,
      `Undo requested: move ${threads.length} back to Inbox.`,
    );
  });
  refresh();
}

async function performRequestAction(form: FormData) {
  const { dataContext, session } = await requireDonna();
  const id = z.string().parse(form.get("requestId"));
  const version = z.coerce.number().int().positive().parse(form.get("version"));
  const action = z
    .enum(["direction", "draft", "follow-up", "complete", "reopen"])
    .parse(form.get("action"));
  const note = z
    .string()
    .trim()
    .min(1)
    .max(action === "draft" ? 20000 : 4000)
    .parse(form.get("note"));
  await withBrandDataTransaction(dataContext, async (tx) => {
    const row = await tx.donnaRequest.findFirstOrThrow({
      where: { id, mailbox: { brandId: dataContext.brandId } },
    });
    if (row.version !== version)
      throw new Error(
        "This request changed. Reload it before saving your decision.",
      );
    const data: import("@prisma/client").Prisma.DonnaRequestUpdateManyMutationInput =
      { version: { increment: 1 } };
    if (action === "direction") {
      data.direction = note;
      data.state = "working";
      data.nextAction = "Donna to apply your direction.";
    }
    if (action === "draft") {
      const draft = draftSchema.parse({ ...(row.draft as object), body: note });
      data.draft = draft;
      data.state = "needs-you";
      data.draftEdited = true;
      data.draftStale = false;
    }
    if (action === "follow-up") {
      const date = z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
        .parse(form.get("followUpAt"));
      const hour = Number(date.slice(11, 13)),
        minute = Number(date.slice(14, 16));
      if (hour > 23 || minute > 59)
        throw new Error("Choose a valid follow-up time.");
      const instant = new Date(
        firmInstant(date.slice(0, 10), hour).getTime() + minute * 60000,
      );
      data.followUpAt = instant;
      data.waitingOn = note;
      data.state = "waiting";
    }
    if (action === "complete") {
      data.state = "handled";
      data.completedAt = new Date();
      data.completionNote = note;
      data.draft = Prisma.DbNull;
      data.followUpAt = null;
      data.waitingOn = null;
    }
    if (action === "reopen") {
      data.state = "working";
      data.completedAt = null;
      data.completionNote = null;
      data.nextAction = note;
    }
    const changed = await tx.donnaRequest.updateMany({
      where: { id, version },
      data,
    });
    if (changed.count !== 1)
      throw new Error("This request changed; reload it.");
    await tx.donnaActivity.create({
      data: {
        mailboxId: row.mailboxId,
        requestId: row.id,
        eventKey: `decision:${row.id}:${version}:${action}`,
        kind:
          action === "complete"
            ? "completed"
            : action === "reopen"
              ? "reopened"
              : "direction",
        detail: note,
        actor: session.user.id,
        evidence:
          "Authenticated operator supplied this direction or completion evidence.",
        occurredAt: new Date(),
      },
    });
    if (action === "direction")
      await enqueue(
        tx,
        row.mailboxId,
        "direction",
        `direction:${row.id}:${version}`,
      );
  });
  refresh();
}

export async function requestAction(
  form: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    await performRequestAction(form);
    return { ok: true, message: "Saved." };
  } catch (error) {
    if (error instanceof z.ZodError)
      return {
        ok: false,
        message:
          "Check the fields and choose a valid follow-up date if needed.",
      };
    const message = error instanceof Error ? error.message : "";
    return {
      ok: false,
      message: message.startsWith("This request changed")
        ? message
        : "Could not save. Reload the request and try again.",
    };
  }
}

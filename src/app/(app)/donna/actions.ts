"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireDonna } from "@/lib/donna/access";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import { enqueue } from "@/lib/donna/store";
import { draftSchema } from "@/lib/donna/domain";
import { firmInstant } from "@/lib/operations/schedule";

function refresh() {
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
): Promise<{ ok: boolean; message: string }> {
  try {
    const { dataContext, session } = await requireDonna();
    const id = z.string().min(1).parse(form.get("mailboxId"));
    await withBrandDataTransaction(dataContext, async (tx) => {
      const box = await tx.donnaMailbox.findFirstOrThrow({
        where: { id, brandId: dataContext.brandId },
      });
      const existing = await tx.donnaJob.findFirst({
        where: {
          mailboxId: box.id,
          kind: "clean",
          status: { in: ["pending", "leased"] },
        },
      });
      if (!existing)
        await enqueue(tx, box.id, "clean", `clean:${randomUUID()}`);
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
    });
    refresh();
    return { ok: true, message: "Cleaning inbox." };
  } catch {
    return {
      ok: false,
      message: "Could not start Clean. Reload and try again.",
    };
  }
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

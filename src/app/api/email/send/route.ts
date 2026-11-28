import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { asRecord } from "@/lib/engagements/acceptedPayment";
import { lockQuoteMutation, QuoteMutationConflictError } from "@/lib/quotes/mutationLock";
import { prisma } from "@/lib/prisma";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import {
  EmailConnectionMissingError,
  EmailConnectionRegionInvalidError,
  sendFromMembership,
} from "@/lib/emailConnections/send";

function trim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

export async function POST(request: Request) {
  const ctx = await requireStaffBrandOrThrow();
  if (!ctx.membership) {
    return NextResponse.json({ error: "Only brand members can send email." }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  const raw = contentType.includes("application/json")
    ? ((await request.json().catch(() => ({}))) as Record<string, unknown>)
    : (Object.fromEntries((await request.formData().catch(() => new FormData())).entries()) as Record<string, unknown>);

  const to = trim(raw.to);
  const subject = trim(raw.subject);
  const bodyText = typeof raw.body === "string" ? raw.body : typeof raw.bodyText === "string" ? raw.bodyText : "";
  const bodyHtml = typeof raw.bodyHtml === "string" ? raw.bodyHtml : undefined;
  const offerId = trim(raw.offerId) || null;

  if (!to || !isEmail(to)) return NextResponse.json({ error: "Enter a valid recipient email." }, { status: 400 });
  if (!subject) return NextResponse.json({ error: "Subject is required." }, { status: 400 });
  if (!bodyText.trim()) return NextResponse.json({ error: "Message body is required." }, { status: 400 });

  const claimId = randomUUID();
  let claimed = false;
  let delivered = false;
  try {
    if (offerId) {
      await prisma.$transaction(async (tx) => {
        const quote = await lockQuoteMutation(tx, ctx.brand.id, offerId, "send");
        await tx.quote.update({ where: { id: offerId }, data: { snapshotJson: {
          ...asRecord(quote.snapshotJson), proposalSendClaim: { id: claimId, state: "sending", startedAt: new Date().toISOString() },
        } as Prisma.InputJsonValue } });
      });
      claimed = true;
    }
    // The claim has committed. No database transaction is open during delivery.
    const controller = new AbortController();
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      deadline = setTimeout(() => {
        controller.abort();
        reject(new Error("Email delivery timed out. Delivery is unknown; staff must check the mailbox before retrying."));
      }, 15_000);
    });
    const result = await Promise.race([sendFromMembership({
      membershipId: ctx.membership.id, brandId: ctx.brand.id,
      to, subject, bodyText, bodyHtml, signal: controller.signal,
    }), timeout]).finally(() => clearTimeout(deadline));
    delivered = true;
    if (offerId) {
      await prisma.$transaction(async (tx) => {
        const quote = await lockQuoteMutation(tx, ctx.brand.id, offerId, "finishSend");
        const snapshot = asRecord(quote.snapshotJson);
        if (asRecord(snapshot.proposalSendClaim).id !== claimId) throw new QuoteMutationConflictError("Email send claim changed; check delivery before retrying.");
        const now = new Date();
        await tx.quote.update({ where: { id: offerId }, data: {
          snapshotJson: { ...snapshot, proposalSendClaim: { id: claimId, state: "sent", messageId: result.messageId, finishedAt: now.toISOString() } } as Prisma.InputJsonValue,
          status: "sent", sentAt: now, firstSentAt: quote.firstSentAt ?? now,
          lastSentAt: now, lastActivityAt: now, ...(quote.firstSentAt ? { lastFollowUpAt: now } : {}),
        } });
      });
    }

    return NextResponse.json({ ok: true, from: result.fromAddress, provider: result.provider });
  } catch (error) {
    if (claimed && offerId) {
      const definiteFailure = error instanceof EmailConnectionMissingError || error instanceof EmailConnectionRegionInvalidError;
      await prisma.$transaction(async (tx) => {
        const quote = await lockQuoteMutation(tx, ctx.brand.id, offerId, "finishSend");
        const snapshot = asRecord(quote.snapshotJson);
        if (asRecord(snapshot.proposalSendClaim).id !== claimId) return;
        await tx.quote.update({ where: { id: offerId }, data: { snapshotJson: {
          ...snapshot, proposalSendClaim: { id: claimId, state: definiteFailure ? "failed" : "unknown",
            delivered, finishedAt: new Date().toISOString() },
        } as Prisma.InputJsonValue } });
      }).catch(() => undefined); // The durable 'sending' claim still blocks retries/signing.
    }
    if (delivered) return NextResponse.json({ ok: true, deliveryRecorded: false,
      warning: "Email was sent, but its offer stamp failed. Staff must check delivery; do not resend." });
    if (error instanceof QuoteMutationConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof EmailConnectionMissingError) {
      return NextResponse.json({ error: error.message, code: "not-connected" }, { status: 409 });
    }
    if (error instanceof EmailConnectionRegionInvalidError) {
      return NextResponse.json({ error: error.message, code: "invalid-region" }, { status: 409 });
    }
    console.error("[email/send] Failed:", error);
    const message = error instanceof Error ? error.message : "Send failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

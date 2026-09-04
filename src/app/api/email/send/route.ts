import { NextResponse } from "next/server";
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

  try {
    const result = await sendFromMembership({
      membershipId: ctx.membership.id,
      brandId: ctx.brand.id,
      to,
      subject,
      bodyText,
      bodyHtml,
    });

    if (offerId) {
      const quote = await prisma.quote.findFirst({
        where: { id: offerId, brandId: ctx.brand.id },
        select: { id: true, status: true, firstSentAt: true },
      });
      if (quote && (quote.status === "draft" || quote.status === "completed" || quote.status === "sent")) {
        const now = new Date();
        const isFollowUp = Boolean(quote.firstSentAt);
        await prisma.quote.update({
          where: { id: quote.id },
          data: {
            status: "sent",
            sentAt: now,
            firstSentAt: quote.firstSentAt ?? now,
            lastSentAt: now,
            lastActivityAt: now,
            ...(isFollowUp ? { lastFollowUpAt: now } : {}),
          },
        });
      }
    }

    return NextResponse.json({ ok: true, from: result.fromAddress, provider: result.provider });
  } catch (error) {
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

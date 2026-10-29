import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sanitizeSessionId, sanitizeViewEvents } from "@/lib/quotes/viewEvents";

// Public, write-only. Records what a client does on the live proposal page.
// It must never break the proposal, so every failure answers 204 and is only logged.
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      token?: unknown;
      sessionId?: unknown;
      events?: unknown;
    } | null;
    const token = typeof body?.token === "string" ? body.token : "";
    const sessionId = sanitizeSessionId(body?.sessionId);
    const events = sanitizeViewEvents(body?.events);
    if (!token || !sessionId || events.length === 0) return new NextResponse(null, { status: 204 });

    const quote = await prisma.quote.findFirst({
      where: { publicToken: token, publishedAt: { not: null } },
      select: { id: true },
    });
    if (!quote) return new NextResponse(null, { status: 204 });

    await prisma.proposalViewEvent.createMany({
      data: events.map((event) => ({ quoteId: quote.id, sessionId, ...event })),
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[proposal/track]", error);
    return new NextResponse(null, { status: 204 });
  }
}

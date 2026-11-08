import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordSalesEvidence } from "@/lib/automation/evidence";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { authenticatePipeRequest, resolveBrand, PipeBrandError } from "@/lib/pipe/contacts";

export const dynamic = "force-dynamic";

const SOURCES = new Set(["website", "quo", "zoho", "calendar", "qbo", "stripe", "agreement"]);
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: Request) {
  const auth = authenticatePipeRequest(request.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.status === 503 ? "Pipe API is not configured." : "Unauthorized." }, { status: auth.status });
  }
  if (!checkRateLimit("pipe-evidence", 120, 60_000).allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
  }
  const raw = body as Record<string, unknown>;
  const brandSlug = clean(raw.brand, 100);
  const source = clean(raw.source, 30);
  const sourceEventId = clean(raw.sourceEventId, 200);
  const eventType = clean(raw.eventType, 100);
  const leadId = clean(raw.leadId, 100);
  const summary = clean(raw.summary, 1000);
  const sourceRef = clean(raw.sourceRef, 500);
  const occurredAt = new Date(String(raw.occurredAt ?? ""));
  if (!brandSlug || !SOURCES.has(source) || !sourceEventId || !/^[a-z][a-z0-9._-]*$/.test(eventType) || !leadId || !summary || !Number.isFinite(occurredAt.getTime())) {
    return NextResponse.json({ error: "brand, source, sourceEventId, eventType, leadId, occurredAt, and summary are required." }, { status: 400 });
  }
  try {
    const brand = await resolveBrand(brandSlug);
    const eventId = await prisma.$transaction(async (tx) => {
      const lead = await tx.meetingLead.findFirst({ where: { id: leadId, brandId: brand.id, isActive: true }, select: { id: true } });
      if (!lead) return null;
      return recordSalesEvidence(tx, { brandId: brand.id, leadId, source, sourceEventId, eventType, occurredAt, summary, sourceRef: sourceRef || undefined });
    });
    if (!eventId) return NextResponse.json({ error: "Active lead not found for this brand." }, { status: 404 });
    return NextResponse.json({ eventId });
  } catch (error) {
    if (error instanceof PipeBrandError) return NextResponse.json({ error: error.message }, { status: 404 });
    throw error;
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { PipeBrandError, resolveBrand } from "@/lib/pipe/contacts";
import { authenticateOperationsRequest } from "@/lib/operations/api";
import { parseServiceRecord } from "@/lib/operations/serviceRecords";
import { getRecordMrr } from "@/lib/operations/serviceRecordsMrr";
import { syncServiceTags } from "@/lib/operations/serviceTags";
import { ServiceRecordError, upsertServiceRecord } from "@/lib/operations/serviceRecordStore";

/**
 * Service records (concepts/service-records-design). GET lists them with
 * today's MRR under the rule; PUT upserts one record by its sourceKey, so a
 * loader can be run again safely. MRR is the dashboard's: clients counted by
 * their recurring service tag, fees from records.
 */

function unauthorized(status: 401 | 503) {
  return NextResponse.json(
    { error: status === 503 ? "Operations API is not configured." : "Unauthorized." },
    { status },
  );
}

const day = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null);

export async function GET(request: Request) {
  const auth = authenticateOperationsRequest(request.headers.get("authorization"));
  if (!auth.ok) return unauthorized(auth.status);
  try {
    const brand = await resolveBrand(new URL(request.url).searchParams.get("brand")?.trim() ?? "");
    const rows = await prisma.serviceRecord.findMany({
      where: { brandId: brand.id },
      orderBy: [{ startDate: "asc" }],
      include: { contact: { select: { name: true } }, previous: { select: { sourceKey: true } } },
    });
    const records = rows.map((r) => ({
      sourceKey: r.sourceKey,
      contactId: r.contactId,
      contactName: r.contact.name,
      engagementId: r.engagementId,
      product: r.product,
      basis: r.basis,
      feeAmount: r.feeAmount === null ? null : Number(r.feeAmount),
      startDate: day(r.startDate)!,
      endDate: day(r.endDate),
      endReason: r.endReason,
      evidenceSource: r.evidenceSource,
      evidenceRef: r.evidenceRef,
      evidenceDate: day(r.evidenceDate),
      previousSourceKey: r.previous?.sourceKey ?? null,
    }));
    // Same numbers as the dashboard: counted by tag, fees from records.
    const counted = await getRecordMrr(brand.id);
    return NextResponse.json({
      today: counted.day,
      mrr: { total: counted.clients.reduce((sum, c) => sum + c.mrr, 0), clients: counted.clients.length },
      mismatches: counted.mismatches,
      records,
    });
  } catch (error) {
    if (error instanceof PipeBrandError) return NextResponse.json({ error: error.message }, { status: 404 });
    throw error;
  }
}

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const auth = authenticateOperationsRequest(request.headers.get("authorization"));
  if (!auth.ok) return unauthorized(auth.status);
  if (!checkRateLimit("operations-service-records", 120, 60_000).allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
  }
  const raw = body as Record<string, unknown>;
  const input = parseServiceRecord(raw);
  if (typeof input === "string") return NextResponse.json({ error: input }, { status: 400 });
  try {
    const brand = await resolveBrand(typeof raw.brand === "string" ? raw.brand.trim() : "");
    const record = await upsertServiceRecord(brand.id, input);
    // The record sets the contact's service and client tags.
    const tags = await syncServiceTags(brand.id, { contactIds: [record.contactId] });
    return NextResponse.json({ id: record.id, sourceKey: record.sourceKey, created: record.created, tags: tags[0] ?? null });
  } catch (error) {
    if (error instanceof PipeBrandError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof ServiceRecordError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}

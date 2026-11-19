import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PipeBrandError, resolveBrand } from "@/lib/pipe/contacts";
import { authenticateOperationsRequest } from "@/lib/operations/api";
import { firmDateKey } from "@/lib/operations/schedule";
import { isActiveOn, isoDay, recordsFromAgreement } from "@/lib/operations/serviceRecords";
import { contactIdByEmail, ServiceRecordError, upsertServiceRecord } from "@/lib/operations/serviceRecordStore";
import { syncServiceTags } from "@/lib/operations/serviceTags";

export const dynamic = "force-dynamic";

/**
 * Open service records from a signed agreement (QBO Contracts path): body
 * { brand, agreement: <builder JSON>, evidenceRef: <signed PDF path>,
 * evidenceDate, dryRun }. A product the client already has active or
 * starting (for example from its SWapp proposal) is skipped, never doubled.
 */
export async function POST(request: Request) {
  const auth = authenticateOperationsRequest(request.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 503 ? "Operations API is not configured." : "Unauthorized." },
      { status: auth.status },
    );
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const agreement = body?.agreement;
  if (!agreement || typeof agreement !== "object" || Array.isArray(agreement)) {
    return NextResponse.json({ error: "agreement must be the builder JSON object" }, { status: 400 });
  }
  const evidenceRef = typeof body?.evidenceRef === "string" ? body.evidenceRef.trim().slice(0, 500) : "";
  if (!evidenceRef) return NextResponse.json({ error: "evidenceRef (signed agreement path) is required" }, { status: 400 });
  const records = recordsFromAgreement(agreement as Record<string, unknown>, {
    evidenceRef,
    evidenceDate: isoDay(body?.evidenceDate),
  });
  if (typeof records === "string") return NextResponse.json({ error: records }, { status: 400 });
  try {
    const brand = await resolveBrand(typeof body?.brand === "string" ? body.brand.trim() : "");
    const contactId = await contactIdByEmail(brand.id, records[0].contactEmail ?? "");
    if (!contactId) return NextResponse.json({ error: `no active contact with email ${records[0].contactEmail}` }, { status: 400 });
    const today = firmDateKey(new Date());
    const held = await prisma.serviceRecord.findMany({
      where: { brandId: brand.id, contactId },
      select: { product: true, sourceKey: true, startDate: true, endDate: true },
    });
    const results: { sourceKey: string; product: string; outcome: string }[] = [];
    for (const record of records) {
      // Another record of the same product already covers it: active or
      // starting, or (a one-time job, possibly finished) starting within 31 days.
      const other = held.find((h) => {
        if (h.product !== record.product || h.sourceKey === record.sourceKey) return false;
        const span = { startDate: h.startDate.toISOString().slice(0, 10), endDate: h.endDate?.toISOString().slice(0, 10) ?? null };
        const apartDays = Math.abs(h.startDate.getTime() - Date.parse(`${record.startDate}T00:00:00Z`)) / 86_400_000;
        return isActiveOn(span, today) || span.startDate > today || apartDays <= 31;
      });
      if (other) {
        results.push({ sourceKey: record.sourceKey, product: record.product, outcome: `skipped: already on file (${other.sourceKey})` });
        continue;
      }
      if (body?.dryRun === true) {
        results.push({ sourceKey: record.sourceKey, product: record.product, outcome: "would open" });
        continue;
      }
      const saved = await upsertServiceRecord(brand.id, { ...record, contactId });
      results.push({ sourceKey: record.sourceKey, product: record.product, outcome: saved.created ? "opened" : "updated" });
    }
    const tags = body?.dryRun === true ? [] : await syncServiceTags(brand.id, { contactIds: [contactId] });
    return NextResponse.json({ contactId, results, tags: tags[0] ?? null });
  } catch (error) {
    if (error instanceof PipeBrandError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof ServiceRecordError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}

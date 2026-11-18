import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { PipeBrandError, resolveBrand } from "@/lib/pipe/contacts";
import { authenticateOperationsRequest, parseEvidence } from "@/lib/operations/api";

export const dynamic = "force-dynamic";

/** Agents post proof that a playbook duty was done (or why it was not). */
export async function POST(request: Request) {
  const auth = authenticateOperationsRequest(request.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 503 ? "Operations API is not configured." : "Unauthorized." },
      { status: auth.status },
    );
  }
  if (!checkRateLimit("operations-evidence", 240, 60_000).allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
  }
  const raw = body as Record<string, unknown>;
  const input = parseEvidence(raw, new Date());
  if (typeof input === "string") return NextResponse.json({ error: input }, { status: 400 });

  try {
    const brand = await resolveBrand(typeof raw.brand === "string" ? raw.brand.trim() : "");
    let clientId: string | null = null;
    if (input.clientKey) {
      const client = await prisma.operationsClient.findFirst({
        where: { brandId: brand.id, key: input.clientKey, active: true },
        select: { id: true },
      });
      if (!client) {
        return NextResponse.json({ error: `No active Operations client ${input.clientKey}.` }, { status: 404 });
      }
      clientId = client.id;
    }
    const existing = await prisma.operationsEvidence.findUnique({
      where: { brandId_sourceEventId: { brandId: brand.id, sourceEventId: input.sourceEventId } },
      select: { id: true },
    });
    if (existing) return NextResponse.json({ id: existing.id, duplicate: true });
    const row = await prisma.operationsEvidence.create({
      data: {
        brandId: brand.id,
        dutyId: input.dutyId,
        operationsClientId: clientId,
        period: new Date(`${input.period}T00:00:00Z`),
        status: input.status,
        summary: input.summary,
        details: input.details === null ? Prisma.JsonNull : (input.details as Prisma.InputJsonValue),
        sourceRef: input.sourceRef || null,
        reportedBy: input.reportedBy,
        sourceEventId: input.sourceEventId,
        occurredAt: input.occurredAt,
      },
      select: { id: true, period: true },
    });
    return NextResponse.json({ id: row.id, period: input.period }, { status: 201 });
  } catch (error) {
    if (error instanceof PipeBrandError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ duplicate: true });
    }
    throw error;
  }
}

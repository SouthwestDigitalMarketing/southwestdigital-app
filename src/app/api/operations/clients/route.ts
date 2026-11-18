import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { PipeBrandError, resolveBrand } from "@/lib/pipe/contacts";
import { authenticateOperationsRequest, parseClient } from "@/lib/operations/api";

export const dynamic = "force-dynamic";

/** Enroll or update one Operations client, keyed by its slug. */
export async function PUT(request: Request) {
  const auth = authenticateOperationsRequest(request.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 503 ? "Operations API is not configured." : "Unauthorized." },
      { status: auth.status },
    );
  }
  if (!checkRateLimit("operations-clients", 60, 60_000).allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
  }
  const raw = body as Record<string, unknown>;
  const input = parseClient(raw);
  if (typeof input === "string") return NextResponse.json({ error: input }, { status: 400 });
  try {
    const brand = await resolveBrand(typeof raw.brand === "string" ? raw.brand.trim() : "");
    const data = {
      name: input.name,
      doubleClientId: input.doubleClientId,
      qbCompany: input.qbCompany,
      startsOn: new Date(`${input.startsOn}T00:00:00Z`),
      active: input.active,
    };
    const client = await prisma.operationsClient.upsert({
      where: { brandId_key: { brandId: brand.id, key: input.key } },
      create: { brandId: brand.id, key: input.key, ...data },
      update: data,
      select: { id: true, key: true, active: true },
    });
    return NextResponse.json(client);
  } catch (error) {
    if (error instanceof PipeBrandError) return NextResponse.json({ error: error.message }, { status: 404 });
    throw error;
  }
}

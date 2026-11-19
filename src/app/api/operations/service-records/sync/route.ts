import { NextResponse } from "next/server";
import { PipeBrandError, resolveBrand } from "@/lib/pipe/contacts";
import { authenticateOperationsRequest } from "@/lib/operations/api";
import { syncServiceTags } from "@/lib/operations/serviceTags";

/** Set every contact's service and client tags from its records. `dryRun: true` only lists the changes. */
export async function POST(request: Request) {
  const auth = authenticateOperationsRequest(request.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 503 ? "Operations API is not configured." : "Unauthorized." },
      { status: auth.status },
    );
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    const brand = await resolveBrand(typeof body?.brand === "string" ? body.brand.trim() : "");
    const changes = await syncServiceTags(brand.id, { dryRun: body?.dryRun === true });
    return NextResponse.json({ dryRun: body?.dryRun === true, changes });
  } catch (error) {
    if (error instanceof PipeBrandError) return NextResponse.json({ error: error.message }, { status: 404 });
    throw error;
  }
}

export const dynamic = "force-dynamic";

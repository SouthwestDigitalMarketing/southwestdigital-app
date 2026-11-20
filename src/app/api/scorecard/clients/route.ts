import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { PipeBrandError, resolveBrand } from "@/lib/pipe/contacts";
import { authenticateOperationsRequest } from "@/lib/operations/api";
import { listScorecardClients } from "@/lib/scorecard/clients";

export const dynamic = "force-dynamic";

/** Clients the Scorecard collector matches events against (docs/scorecard-api.md). */
export async function GET(request: Request) {
  const auth = authenticateOperationsRequest(request.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 503 ? "Operations API is not configured." : "Unauthorized." },
      { status: auth.status },
    );
  }
  if (!checkRateLimit("scorecard-clients", 60, 60_000).allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const slug = new URL(request.url).searchParams.get("brand")?.trim() ?? "";
  if (!slug) return NextResponse.json({ error: "brand is required (brand slug)" }, { status: 400 });

  try {
    const brand = await resolveBrand(slug);
    const clients = await listScorecardClients(brand.id);
    return NextResponse.json({ brand: brand.slug, clients });
  } catch (error) {
    if (error instanceof PipeBrandError) return NextResponse.json({ error: error.message }, { status: 404 });
    throw error;
  }
}

import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { PipeBrandError, resolveBrand } from "@/lib/pipe/contacts";
import { authenticateOperationsRequest } from "@/lib/operations/api";
import { ingestScorecard, parseIngestBody } from "@/lib/scorecard/ingest";

export const dynamic = "force-dynamic";

/** The Scorecard collector posts response-time events (docs/scorecard-api.md). */
export async function POST(request: Request) {
  const auth = authenticateOperationsRequest(request.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 503 ? "Operations API is not configured." : "Unauthorized." },
      { status: auth.status },
    );
  }
  if (!checkRateLimit("scorecard-ingest", 120, 60_000).allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  const now = new Date();
  const input = parseIngestBody(body, now);
  if (typeof input === "string") return NextResponse.json({ error: input }, { status: 400 });

  try {
    const brand = await resolveBrand(input.brand);
    const result = await ingestScorecard(brand.id, input, now);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PipeBrandError) return NextResponse.json({ error: error.message }, { status: 404 });
    throw error;
  }
}

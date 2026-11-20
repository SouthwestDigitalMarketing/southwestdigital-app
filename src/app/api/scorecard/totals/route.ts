import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { PipeBrandError, resolveBrand } from "@/lib/pipe/contacts";
import { authenticateOperationsRequest } from "@/lib/operations/api";
import { parseTotalsBody, replaceTotals } from "@/lib/scorecard/totals";

export const dynamic = "force-dynamic";

/** The nightly totals job posts one metric's monthly counts (docs/scorecard-api.md § Totals). */
export async function POST(request: Request) {
  const auth = authenticateOperationsRequest(request.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 503 ? "Operations API is not configured." : "Unauthorized." },
      { status: auth.status },
    );
  }
  if (!checkRateLimit("scorecard-totals", 30, 60_000).allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  const now = new Date();
  const input = parseTotalsBody(body, now);
  if (typeof input === "string") return NextResponse.json({ error: input }, { status: 400 });

  try {
    const brand = await resolveBrand(input.brand);
    return NextResponse.json(await replaceTotals(brand.id, input, now));
  } catch (error) {
    if (error instanceof PipeBrandError) return NextResponse.json({ error: error.message }, { status: 404 });
    throw error;
  }
}

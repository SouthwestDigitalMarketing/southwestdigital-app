import { NextResponse } from "next/server";
import { authenticateOperationsRequest } from "@/lib/operations/api";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { parseCashFlowPayload, upsertCashFlow } from "@/lib/companyMetrics/ingest";

export async function POST(request: Request) {
  const auth = authenticateOperationsRequest(request.headers.get("authorization"));
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  if (!checkRateLimit("company-cash-flow", 10, 60_000).allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const input = parseCashFlowPayload(await request.json().catch(() => null));
  if (typeof input === "string") return NextResponse.json({ error: input }, { status: 400 });
  return NextResponse.json(await upsertCashFlow(input));
}

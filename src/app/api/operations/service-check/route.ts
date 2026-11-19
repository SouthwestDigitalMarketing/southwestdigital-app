import { NextResponse } from "next/server";
import { PipeBrandError, resolveBrand } from "@/lib/pipe/contacts";
import { authenticateOperationsRequest } from "@/lib/operations/api";
import { runServiceCheck } from "@/lib/operations/serviceCheck";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Daily service-records check. Body: { brand, month: "YYYY-MM", billing:
 * [{ customer, amount }] (QuickBooks Sales by Customer), fix }. `ops
 * service-check` sends it from ripley, where `qb` reads QuickBooks.
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
  const month = typeof body?.month === "string" ? body.month.trim() : "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });
  if (!Array.isArray(body?.billing)) return NextResponse.json({ error: "billing must be an array" }, { status: 400 });
  const billing: { customer: string; amount: number }[] = [];
  for (const row of body.billing as unknown[]) {
    const r = (row ?? {}) as Record<string, unknown>;
    const customer = typeof r.customer === "string" ? r.customer.trim().slice(0, 200) : "";
    const amount = Number(r.amount);
    if (!customer || !Number.isFinite(amount)) return NextResponse.json({ error: "each billing row needs customer and amount" }, { status: 400 });
    if (amount !== 0) billing.push({ customer, amount });
  }
  try {
    const brand = await resolveBrand(typeof body.brand === "string" ? body.brand.trim() : "");
    const items = await runServiceCheck({ brandId: brand.id, month, billing, fix: body.fix === true });
    return NextResponse.json({ month, items });
  } catch (error) {
    if (error instanceof PipeBrandError) return NextResponse.json({ error: error.message }, { status: 404 });
    throw error;
  }
}

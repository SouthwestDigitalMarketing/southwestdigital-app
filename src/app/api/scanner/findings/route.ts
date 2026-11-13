import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { authenticateScannerRequest } from "@/lib/scanner/auth";
import { parseScanIngest } from "@/lib/scanner/ingest";
import { findScannerBrand, isScanStorageMissing, postScanFinding } from "@/lib/scanner/post";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = authenticateScannerRequest(request.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.status === 503 ? "Scanner API is not configured." : "Unauthorized." },
      { status: auth.status },
    );
  }
  if (!checkRateLimit("scanner-findings", 120, 60_000).allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  const parsed = parseScanIngest(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const brand = await findScannerBrand(parsed.value.brand);
  if (!brand || brand.deletedAt || brand.status !== "ACTIVE") {
    return NextResponse.json({ error: "Bookkeeping Conroe was not found." }, { status: 404 });
  }

  try {
    const result = await postScanFinding({
      brandId: brand.id,
      actorUserId: auth.actorUserId,
      input: parsed.value,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (isScanStorageMissing(error)) {
      return NextResponse.json({ error: "Scanner tables are not in the database yet." }, { status: 503 });
    }
    throw error;
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/simpleRateLimit";
import { COMPANY_BRANDS } from "@/lib/companyMetrics";
import { checkScanToken } from "@/lib/scan/auth";
import { listActiveRules } from "@/lib/scan/questions";

export const dynamic = "force-dynamic";

/** The ripley's poller fetches the active tap-answer rules every run so
 * answers apply automatically next time. Small enough to fetch every run. */
export async function GET(request: Request) {
  const auth = checkScanToken(request.headers.get("authorization"));
  if (!auth.ok) {
    const message = auth.status === 503 ? "Scan is not configured." : "Unauthorized.";
    return NextResponse.json({ error: message }, { status: auth.status });
  }
  if (!checkRateLimit("scan-rules", 120, 60_000).allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const brands = await prisma.brand.findMany({
    where: { slug: { in: [...COMPANY_BRANDS] }, status: "ACTIVE" },
    select: { id: true, slug: true },
  });
  const rules = [];
  for (const brand of brands) {
    const active = await listActiveRules(prisma, brand.id);
    for (const rule of active) rules.push({ brand: brand.slug, ...rule });
  }
  return NextResponse.json({ rules });
}

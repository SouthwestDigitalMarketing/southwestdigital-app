import { NextResponse } from "next/server";
import { requireAppBrand } from "@/lib/brands/staff";
import { loadActiveClean } from "@/lib/donna/store";

export const dynamic = "force-dynamic";

/** Active inbox-clean job for the app-wide status bar. */
export async function GET() {
  const ctx = await requireAppBrand();
  if (!ctx.isPlatformOperator || ctx.brand.slug !== "bookkeeping-conroe")
    return NextResponse.json(
      { job: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  const job = await loadActiveClean(ctx.dataContext);
  return NextResponse.json(
    { job: job ? { id: job.id, status: job.status } : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

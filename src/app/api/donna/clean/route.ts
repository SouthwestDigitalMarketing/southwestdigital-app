import { NextResponse } from "next/server";
import { requireAppBrand } from "@/lib/brands/staff";
import { loadActiveClean } from "@/lib/donna/store";
import { cleanBarStatus } from "@/lib/donna/domain";

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
    {
      job: job
        ? cleanBarStatus(
            job,
            job.mailbox.coverage,
            new Date(),
            job.mailbox.paused,
            job.mailbox.heartbeatAt,
          )
        : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

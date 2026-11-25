import Link from "next/link";
import { requireAppBrand } from "@/lib/brands/staff";
import { parseRange } from "../dashboard/_scorecard/format";

export default async function ScorecardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const { isPlatformOperator, brand } = await requireAppBrand();
  const range = parseRange((await searchParams).range);
  return (
    <main className="mx-auto min-h-[calc(100dvh-3.5rem)] max-w-4xl space-y-5 bg-slate-50 p-4 text-slate-900 sm:p-6">
      <h1 className="text-xl font-semibold">Scorecard</h1>
      <p className="text-sm text-slate-500">
        Service, speed and work completed.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {isPlatformOperator && brand.slug === "bookkeeping-conroe" ? (
          <Link
            href="/scorecard/email"
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <h2 className="font-semibold">Email</h2>
            <p className="mt-2 text-sm text-slate-500">
              Donna’s activity and results
            </p>
          </Link>
        ) : null}
        <Link
          href={`/dashboard?rt=${range}#response-times`}
          className="rounded-xl border border-slate-200 bg-white p-5"
        >
          <h2 className="font-semibold">Client service</h2>
          <p className="mt-2 text-sm text-slate-500">
            Response times and outstanding replies
          </p>
        </Link>
      </div>
    </main>
  );
}

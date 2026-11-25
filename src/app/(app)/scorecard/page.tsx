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
    <div className="w-full min-w-0 space-y-5 px-4 py-5 text-slate-900 sm:p-8">
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
    </div>
  );
}

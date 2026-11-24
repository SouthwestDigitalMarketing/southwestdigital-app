import Link from "next/link";
import { requireAppBrand } from "@/lib/brands/staff";
import { monthLabel, reportMonths, thisMonth } from "@/lib/showrunner/month";
import { REPORT_SECTIONS } from "@/lib/showrunner/reports";

export const dynamic = "force-dynamic";

/** One report per month, newest first (Tom, 2026-11-24). The reports themselves are added later. */
export default async function ReportsPage() {
  await requireAppBrand();
  const now = new Date();
  const current = thisMonth(now).month;
  return (
    <div className="px-4 py-5 sm:p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
      <ul className="mt-4 flex max-w-xl flex-col gap-2">
        {reportMonths(now).map((month) => (
          <li key={month}>
            <Link
              href={`/showrunner/reports/${month}`}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-slate-400"
            >
              <span className="font-semibold text-slate-900">{monthLabel(month)}</span>
              <span className="text-xs text-slate-500">
                {month === current ? "In progress" : REPORT_SECTIONS.length ? "Ready" : "Coming soon"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

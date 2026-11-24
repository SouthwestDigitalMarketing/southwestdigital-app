import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAppBrand } from "@/lib/brands/staff";
import { isReportMonth, monthLabel } from "@/lib/showrunner/month";
import { REPORT_SECTIONS } from "@/lib/showrunner/reports";

export const dynamic = "force-dynamic";

/** One month's report: every section in REPORT_SECTIONS, in order. None are built yet. */
export default async function MonthReportPage({ params }: { params: Promise<{ month: string }> }) {
  await requireAppBrand();
  const { month } = await params;
  if (!isReportMonth(month, new Date())) notFound();
  return (
    <div className="px-4 py-5 sm:p-8">
      <Link href="/showrunner/reports" className="text-sm font-semibold text-slate-500">← Reports</Link>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">{monthLabel(month)}</h1>
      {REPORT_SECTIONS.length === 0 ? (
        <p className="mt-3 max-w-xl text-slate-600">No reports yet. They will show up here once they are built.</p>
      ) : (
        <div className="mt-4 flex max-w-3xl flex-col gap-4">
          {REPORT_SECTIONS.map(({ key, title, Section }) => (
            <section key={key} className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
              <div className="mt-3"><Section month={month} /></div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

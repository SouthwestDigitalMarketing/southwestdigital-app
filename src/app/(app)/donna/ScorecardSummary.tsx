import Link from "next/link";
import { requireDonna } from "@/lib/donna/access";
import { loadActivity, storageMissing } from "@/lib/donna/store";
import { activityPeriod } from "@/lib/donna/period";

export async function DonnaScorecardSummary() {
  const { dataContext } = await requireDonna();
  const p = activityPeriod("today");
  let data;
  try {
    data = await loadActivity(dataContext, p.start, p.end);
  } catch (e) {
    if (!storageMissing(e)) throw e;
    return null;
  }
  const { counts } = data;
  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Donna · Email today</h2>
        <Link className="text-sm underline" href="/scorecard/email">
          Full scorecard
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ["Reviewed", counts.reviewed],
          ["Handled", counts.handled],
          ["Spam", counts.spam],
          ["Requests finished", counts.completed],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-2xl font-semibold tabular-nums">{value ?? 0}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

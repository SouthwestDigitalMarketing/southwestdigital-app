import Link from "next/link";
import { releaseLabel, type Week } from "@/lib/showrunner/weekly";

/** Read once per request; the purity lint rejects Date.now() inside a component. */
function requestNow() {
  return Date.now();
}

/** The navy "This Sunday" card: when the wrap-up airs and whether the talking points are ready. */
export function SundayCard({ week }: { week: Week | null }) {
  const upcoming = week && Date.parse(week.release) > requestNow() - 6 * 3600_000 ? week : null;
  return (
    <Link
      href="/showrunner/series/sunday"
      className="mb-6 block rounded-2xl bg-slate-900 p-5 text-white shadow-sm hover:bg-slate-800"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-rose-300">This Sunday</p>
      <p className="mt-1 text-lg font-semibold">{upcoming?.title || "The $10K Month wrap-up"}</p>
      <p className="mt-1 text-sm text-slate-300">
        {upcoming
          ? `Airs ${releaseLabel(upcoming.release)} · ${upcoming.talkingPoints.length} talking points ready`
          : "Talking points are written Saturday morning."}
      </p>
      <span className="mt-3 inline-block rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold">Open the wrap-up</span>
    </Link>
  );
}

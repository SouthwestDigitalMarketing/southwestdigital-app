import Link from "next/link";
import { requireAppBrand } from "@/lib/brands/staff";
import { ChannelGraph } from "@/components/showrunner/ChannelGraph";
import type { GraphData } from "@/lib/showrunner/graph-layout";
import graphData from "@/lib/showrunner/channel-graph.json";
import { loadWeek } from "@/lib/showrunner/load";
import { schedule } from "@/lib/showrunner/release-schedule";
import { releaseLabel } from "@/lib/showrunner/weekly";
import { SundayCard } from "../SundayCard";

export const dynamic = "force-dynamic";

const card = "block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

/** Read once per request; the purity lint rejects Date.now() inside a component. */
function requestNow() {
  return Date.now();
}

/** The season: each Sunday's wrap-up is built from that week's daily videos (Tom, 2026-11-24). */
export default async function SeriesPage() {
  const { dataContext } = await requireAppBrand();
  const week = await loadWeek(dataContext);
  const now = requestNow();
  const next = schedule.releases.find((release) => Date.parse(release.at) > now - 6 * 3600_000);

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl font-semibold text-slate-900">{schedule.season}</h1>
      <p className="mt-1 text-slate-600">
        Season 1 · {schedule.releases.length} episodes · Sundays 5 PM. Each one wraps up that week, with clips from the daily videos.
      </p>
      <div className="mt-5 max-w-xl">
        <SundayCard week={week} />
        <ol className="flex flex-col gap-2">
          {schedule.releases.map((release) => {
            const aired = Date.parse(release.at) < now;
            const isNext = release === next;
            return (
              <li
                key={release.episode}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                  isNext ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-white"
                }`}
              >
                <span className="text-sm font-semibold text-slate-900">Episode {release.episode}</span>
                <span className="text-sm text-slate-600">{releaseLabel(release.at)}</span>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    aired ? "bg-emerald-50 text-emerald-700" : isNext ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {aired ? "Aired" : isNext ? "Next" : "Planned"}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="mt-6 flex max-w-xl flex-col gap-4">
        <Link href="/showrunner/studio" className={`${card} hover:border-indigo-400`}>
          <p className="text-lg font-semibold text-slate-900">Studio · the mountain to $10K</p>
          <p className="mt-1 text-sm text-slate-600">Where the business stands and the storylines Showrunner sees.</p>
        </Link>
        <Link href="/showrunner/new-series" className={`${card} hover:border-slate-400`}>
          <p className="text-lg font-semibold text-slate-900">New series</p>
          <p className="mt-1 text-sm text-slate-600">Showrunner suggests a series from your channel and business.</p>
        </Link>
      </div>
      <details className="mt-6 max-w-3xl">
        <summary className="cursor-pointer text-sm font-semibold text-slate-600">Channel map</summary>
        <div className="mt-3">
          <ChannelGraph data={graphData as GraphData} />
        </div>
      </details>
    </div>
  );
}

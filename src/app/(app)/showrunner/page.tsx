import Link from "next/link";
import { requireAppBrand } from "@/lib/brands/staff";
import { loadVideoCards, loadWeek } from "@/lib/showrunner/load";
import { InProgress } from "./InProgress";
import { ReleaseCalendar } from "./ReleaseCalendar";
import { SundayCard } from "./SundayCard";

export const dynamic = "force-dynamic";

/**
 * Today (Tom, 2026-11-24): start a video, see the ones being made and the last few out,
 * and what Sunday's wrap-up needs. Channel numbers live on Metrics.
 */
export default async function TodayPage() {
  const { dataContext } = await requireAppBrand();
  const [cards, week] = await Promise.all([loadVideoCards(dataContext), loadWeek(dataContext)]);
  const making = cards.filter((video) => !video.url);
  const published = cards.filter((video) => video.url).slice(0, 3);
  const today = new Date().toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="px-4 py-5 sm:p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Today · {today}</h1>
      <Link
        href="/showrunner/new"
        className="mt-4 mb-6 flex items-center justify-center rounded-2xl bg-rose-600 px-4 py-4 text-lg font-semibold text-white shadow-sm hover:bg-rose-700"
      >
        + New video
      </Link>
      <InProgress videos={making} />
      <SundayCard week={week} />
      <div className="mb-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Out lately</h2>
          <Link href="/showrunner/videos" className="text-sm font-semibold text-rose-700">All videos</Link>
        </div>
        {published.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No videos out yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {published.map((video) => (
              <li key={video.batch}>
                <a
                  href={video.url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-slate-400"
                >
                  {video.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={video.thumbnail} alt="" width={96} height={54} className="shrink-0 rounded object-cover" />
                  ) : null}
                  <span className="min-w-0 flex-1 text-sm font-medium text-slate-900">{video.title || video.project || "Video"}</span>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Out</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ReleaseCalendar initialNow={new Date().toISOString()} />
    </div>
  );
}

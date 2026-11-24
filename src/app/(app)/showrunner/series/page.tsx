import Link from "next/link";
import { requireAppBrand } from "@/lib/brands/staff";
import { ChannelGraph } from "@/components/showrunner/ChannelGraph";
import type { GraphData } from "@/lib/showrunner/graph-layout";
import graphData from "@/lib/showrunner/channel-graph.json";
import canon from "@/lib/showrunner/canon.json";
import { showChannelBrand } from "@/lib/showrunner/channel-brand";
import { loadLatestPublishedVideoId, loadWeek } from "@/lib/showrunner/load";
import { schedule } from "@/lib/showrunner/release-schedule";
import { releaseLabel } from "@/lib/showrunner/weekly";
import { createBrandDataContext } from "@/lib/tenancy/context";

export const dynamic = "force-dynamic";

// The $10K Month playlist on The Real Estate Bookkeeper channel (created in Studio 2026-11-19).
const PLAYLIST_URL = "https://www.youtube.com/playlist?list=PLV4Wps_g39RI";

/** Read once per request; the purity lint rejects Date.now() inside a component. */
function requestNow() {
  return Date.now();
}

function weekOf(releaseAt: string) {
  const start = new Date(Date.parse(releaseAt) - 7 * 86_400_000);
  return `Week of ${start.toLocaleDateString("en-US", { timeZone: schedule.timezone, month: "short", day: "numeric" })}`;
}

/**
 * The series as a streaming-style show page (Tom, 2026-11-24): a dark banner with the title, season line and
 * premise, Play (the playlist) and the next episode, then the episode list. Each Sunday episode wraps up its week.
 */
export default async function SeriesPage() {
  const { brand, session, dataContext } = await requireAppBrand();
  const channel = await showChannelBrand(brand);
  const channelContext = channel.id === brand.id
    ? dataContext
    : createBrandDataContext({ brandId: channel.id, actorUserId: session.user.id });
  const [week, latestVideoId] = await Promise.all([
    loadWeek(dataContext),
    loadLatestPublishedVideoId(channelContext).catch(() => null),
  ]);
  // The newest published video's YouTube picture is the banner.
  const banner = latestVideoId ? `https://i.ytimg.com/vi/${latestVideoId}/maxresdefault.jpg` : null;

  const now = requestNow();
  const next = schedule.releases.find((release) => Date.parse(release.at) > now - 6 * 3600_000) ?? null;
  const nextWeek = week && next && week.release.slice(0, 10) === next.at.slice(0, 10) ? week : null;

  return (
    <div className="min-h-full bg-neutral-950 pb-10 text-white">
      <section className="relative overflow-hidden">
        {banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banner} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/70 to-neutral-950/10" />
        <div className={`relative px-4 pb-6 sm:px-8 ${banner ? "pt-40 sm:pt-56" : "pt-8"}`}>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-500">Series</p>
          <h1 className="mt-1 text-4xl font-black tracking-tight sm:text-6xl">{canon.title}</h1>
          <p className="mt-2 text-sm text-neutral-300">
            <span className="font-semibold text-emerald-400">New episodes Sundays</span> · Season 1 · {schedule.releases.length} episodes
          </p>
          <div className="mt-4 flex max-w-xl flex-col gap-2 sm:flex-row">
            <a
              href={PLAYLIST_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-base font-bold text-black hover:bg-neutral-200"
            >
              <span aria-hidden="true">▶</span> Play
            </a>
            <Link
              href="/showrunner/series/sunday"
              className="flex items-center justify-center rounded-md bg-neutral-700/80 px-5 py-3 text-base font-semibold text-white hover:bg-neutral-600"
            >
              Next episode{next ? ` · ${releaseLabel(next.at).replace(/^\w+, /, "")}` : ""}
            </Link>
          </div>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-neutral-200">{canon.logline}</p>
          <p className="mt-2 max-w-xl text-xs text-neutral-400">{canon.seasonQuestion}</p>
        </div>
      </section>

      <section className="px-4 sm:px-8">
        <div className="flex items-baseline justify-between border-t border-neutral-800 pt-4">
          <h2 className="text-lg font-bold">Episodes</h2>
          <span className="text-sm text-neutral-400">Season 1</span>
        </div>
        <ol className="mt-3 flex max-w-3xl flex-col">
          {schedule.releases.map((release) => {
            const aired = Date.parse(release.at) < now;
            const isNext = release === next;
            const title = isNext && nextWeek?.title ? nextWeek.title : weekOf(release.at);
            const blurb = isNext
              ? nextWeek?.question || "This week's wrap-up: the numbers, the work and clips from the daily videos."
              : aired
                ? "The week's wrap-up."
                : "Wraps up the week before it airs.";
            const inner = (
              <div className="flex gap-3 py-3">
                <div
                  className={`relative flex aspect-video w-32 shrink-0 items-center justify-center overflow-hidden rounded-md sm:w-44 ${
                    isNext ? "bg-red-700" : "bg-neutral-800"
                  }`}
                >
                  <span className="text-3xl font-black text-white/90">{release.episode}</span>
                  {isNext ? (
                    <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold uppercase">Next</span>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug">
                    {release.episode}. {title}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-400">
                    {releaseLabel(release.at)} · {aired ? "Aired" : isNext ? "Up next" : "Coming"}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-neutral-300">{blurb}</p>
                </div>
              </div>
            );
            return (
              <li key={release.episode} className="border-b border-neutral-800/80">
                {isNext ? <Link href="/showrunner/series/sunday" className="block hover:bg-neutral-900">{inner}</Link> : inner}
              </li>
            );
          })}
        </ol>

        <div className="mt-6 flex max-w-3xl flex-col gap-2 text-sm">
          <Link href="/showrunner/studio" className="rounded-md bg-neutral-900 px-4 py-3 font-semibold hover:bg-neutral-800">
            Studio · the mountain to $10K
          </Link>
          <Link href="/showrunner/new-series" className="rounded-md bg-neutral-900 px-4 py-3 font-semibold hover:bg-neutral-800">
            New series
          </Link>
        </div>
        <details className="mt-6 max-w-3xl">
          <summary className="cursor-pointer text-sm font-semibold text-neutral-400">Channel map</summary>
          <div className="mt-3 rounded-xl bg-white p-2">
            <ChannelGraph data={graphData as GraphData} />
          </div>
        </details>
      </section>
    </div>
  );
}

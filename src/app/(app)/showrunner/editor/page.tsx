import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireAppBrand } from "@/lib/brands/staff";
import { showChannelBrand } from "@/lib/showrunner/channel-brand";
import { loadEpisodes } from "@/lib/showrunner/load";
import { createBrandDataContext } from "@/lib/tenancy/context";

export const dynamic = "force-dynamic";

/** "TREB 261121 New Video" → "Nov 21, 2026" (the project name carries the film date as YYMMDD). */
function filmedOn(project: string | null): string | null {
  const match = project?.match(/\b(\d{2})(\d{2})(\d{2})\b/);
  if (!match) return null;
  const date = new Date(Date.UTC(2000 + Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
}

/** Editor tab (Tom, 2026-11-25): choose the episode to change, newest first. */
export default async function EditorPage() {
  const { brand: active, dataContext } = await requireAppBrand();
  const brand = await showChannelBrand(active);
  // A phone upload that never got a project (no title, no project) is not an episode yet.
  const episodes = (await loadEpisodes(createBrandDataContext({ brandId: brand.id, actorUserId: dataContext.actorUserId })))
    .filter((episode) => episode.title || episode.project);
  return (
    <div className="px-4 py-5 sm:p-8">
      <h1 className="text-lg font-semibold text-slate-900">Videos</h1>
      {episodes.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No episodes from ripley yet.</p>
      ) : (
        <ul className="mt-3 flex max-w-3xl flex-col gap-2">
          {episodes.map((episode) => {
            const date = filmedOn(episode.project);
            return (
              <li key={episode.batch}>
                <Link
                  href={`/showrunner/editor/${encodeURIComponent(episode.batch)}`}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2 hover:bg-slate-50"
                >
                  {episode.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element -- inline data: JPEG from ripley
                    <img src={episode.thumbnail} alt="" className="aspect-video w-28 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="aspect-video w-28 shrink-0 rounded-lg bg-slate-100" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{episode.title ?? episode.project ?? "Untitled"}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {[date, episode.url ? "Published" : "In production"].filter(Boolean).join(" · ")}
                    </span>
                    {episode.review ? (
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                        episode.review.score >= 80 ? "bg-emerald-50 text-emerald-800" : episode.review.score >= 50 ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-800"
                      }`}>
                        Score {episode.review.score}
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-slate-400" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAppBrand } from "@/lib/brands/staff";
import { showChannelBrand } from "@/lib/showrunner/channel-brand";
import { loadEpisodes } from "@/lib/showrunner/load";
import { createBrandDataContext } from "@/lib/tenancy/context";
import { WaitingActions } from "@/components/showrunner/WaitingActions";
import { isWaitingForYou } from "@/lib/showrunner/production";
import { requestReview } from "../actions";
import { Scorecard } from "./Scorecard";

export const dynamic = "force-dynamic";

/** One video from the Videos tab (Tom, 2026-11-25): its card, its scorecard and Run review. Editing tools come later. */
export default async function EditEpisodePage({ params }: { params: Promise<{ batch: string }> }) {
  const { batch } = await params;
  const { brand: active, dataContext } = await requireAppBrand();
  const brand = await showChannelBrand(active);
  const episode = (await loadEpisodes(createBrandDataContext({ brandId: brand.id, actorUserId: dataContext.actorUserId })))
    .find((row) => row.batch === batch);
  if (!episode) notFound();
  const waiting = isWaitingForYou(
    Array.isArray(episode.steps) ? (episode.steps as { state: string; label: string }[]) : null,
    episode.stage,
  );
  const finishing = Boolean(episode.finishRequestedAt);
  return (
    <div className="px-4 py-5 sm:p-8">
      <Link href="/showrunner/editor" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600">
        <ChevronLeft size={16} aria-hidden="true" /> All episodes
      </Link>
      <div className="mt-3 max-w-3xl rounded-2xl border border-slate-200 bg-white p-4">
        {episode.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- inline data: JPEG from ripley
          <img src={episode.thumbnail} alt="" className="aspect-video w-full rounded-xl object-cover" />
        ) : null}
        <h1 className="mt-3 text-lg font-semibold leading-snug text-slate-900">{episode.title ?? episode.project ?? "Untitled"}</h1>
        {episode.title && episode.project ? <p className="mt-0.5 text-xs text-slate-500">{episode.project}</p> : null}
        <p className="mt-2 text-sm text-slate-600">{episode.url ? "Published on YouTube" : episode.stage ?? "In production"}</p>
        {episode.url ? (
          <a href={episode.url} target="_blank" rel="noopener" className="mt-3 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Watch on YouTube
          </a>
        ) : null}
        <div className={`-mx-4 -mb-4 mt-4 rounded-b-2xl border-t px-4 pb-4 ${waiting ? "border-amber-200 bg-amber-50" : "border-slate-100"}`}>
          <WaitingActions
            batch={episode.batch}
            finishing={finishing}
            waiting={waiting}
            published={Boolean(episode.url)}
          />
        </div>
      </div>
      {episode.url ? (
        <form action={requestReview.bind(null, episode.batch)} className="mt-4 flex max-w-3xl items-center gap-3">
          <button
            type="submit"
            disabled={episode.reviewRequestedAt !== null}
            className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300"
          >
            {episode.review ? "Run review again" : "Run review"}
          </button>
          {episode.reviewRequestedAt ? <span className="text-sm text-slate-600">Reviewing on ripley. Takes a few minutes.</span> : null}
        </form>
      ) : null}
      {episode.review ? <Scorecard review={episode.review} /> : (
        <p className="mt-4 max-w-3xl rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          {episode.url ? "No scorecard yet." : "The scorecard comes after the video is published."}
        </p>
      )}
    </div>
  );
}

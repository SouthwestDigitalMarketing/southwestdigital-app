import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAppBrand } from "@/lib/brands/staff";
import { VideosInProgress } from "@/components/showrunner/VideosInProgress";
import { showChannelBrand } from "@/lib/showrunner/channel-brand";
import { loadEpisodes, videoCardFromStatus } from "@/lib/showrunner/load";
import { createBrandDataContext } from "@/lib/tenancy/context";
import { requestReview } from "../actions";
import { Scorecard } from "./Scorecard";

export const dynamic = "force-dynamic";

/**
 * One episode (Tom, 2026-11-27): the Videos card and the top status bar both open this page.
 * Steps and render bars, optional thumbnail wording change, transcript, Add clips, and the scorecard once it is live.
 */
export default async function EditEpisodePage({ params }: { params: Promise<{ batch: string }> }) {
  const { batch } = await params;
  const { brand: active, dataContext } = await requireAppBrand();
  const brand = await showChannelBrand(active);
  const episode = (await loadEpisodes(createBrandDataContext({ brandId: brand.id, actorUserId: dataContext.actorUserId })))
    .find((row) => row.batch === batch);
  if (!episode) notFound();
  const video = videoCardFromStatus(episode);
  return (
    <div className="px-4 py-5 sm:p-8 [&_section]:mt-3">
      <Link href="/showrunner/editor" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600">
        <ChevronLeft size={16} aria-hidden="true" /> All episodes
      </Link>
      <h1 className="sr-only">{video.title ?? video.project ?? "Video"}</h1>
      <VideosInProgress videos={[video]} copyBatch={video.batch} heading={false} />
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
      {episode.review ? (
        <Scorecard review={episode.review} />
      ) : (
        <p className="mt-4 max-w-3xl rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          {episode.url ? "No scorecard yet." : "The scorecard comes after the video is published."}
        </p>
      )}
    </div>
  );
}

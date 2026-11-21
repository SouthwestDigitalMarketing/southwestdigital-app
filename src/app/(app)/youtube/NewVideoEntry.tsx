import Link from "next/link";
import { VideosInProgress, type VideoCard } from "@/components/showrunner/VideosInProgress";

/** Create new video, plus any video ripley is still making, so backing out never loses it. */
export function NewVideoEntry({ videos }: { videos: VideoCard[] }) {
  return (
    <div className="mb-6">
      <div className="flex justify-end">
        <Link
          href="/youtube/new"
          className="inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Create new video
        </Link>
      </div>
      <VideosInProgress videos={videos} />
    </div>
  );
}

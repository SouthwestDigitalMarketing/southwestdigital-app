import { VideosInProgress, type VideoCard } from "@/components/showrunner/VideosInProgress";

/** Videos ripley is still making, at the top of Overview, so backing out of an upload never loses it. */
export function InProgress({ videos }: { videos: VideoCard[] }) {
  return (
    <div className="mb-6 empty:hidden">
      <VideosInProgress videos={videos} />
    </div>
  );
}

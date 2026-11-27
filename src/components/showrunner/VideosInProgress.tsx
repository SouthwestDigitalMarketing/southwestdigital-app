"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { VideoDetails, VideoRender, VideoStep } from "@/lib/showrunner/video-status";

export type VideoCard = {
  batch: string;
  project: string | null;
  state: string;
  stage: string | null;
  steps: VideoStep[] | null;
  render: VideoRender | null;
  url: string | null;
  title: string | null;
  thumbnail: string | null;
  details: VideoDetails | null;
  finishRequestedAt?: Date | string | null;
};

const MARK: Record<VideoStep["state"], string> = { done: "✓", now: "●", todo: "○", stopped: "✕" };
const TONE: Record<VideoStep["state"], string> = {
  done: "text-slate-500",
  now: "font-semibold text-slate-900",
  todo: "text-slate-400",
  stopped: "font-semibold text-rose-700",
};

function Bar({ label, share }: { label: string; share: number }) {
  const pct = Math.floor(100 * Math.min(1, Math.max(0, share)));
  return (
    <div className="mt-2 flex items-center gap-3 text-sm text-slate-600">
      <span className="w-36 shrink-0">{label}</span>
      <div className="h-2.5 flex-1 rounded-full bg-slate-200">
        <div className="h-2.5 rounded-full bg-slate-900" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right font-semibold text-slate-900">{pct}%</span>
    </div>
  );
}

function plural(n: number, one: string, many: string) {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

/** "21:39 long · 22 graphics · 0 QuickBooks screens", leaving out what is not known yet. */
function detailLine(details: VideoDetails | null): string | null {
  if (!details) return null;
  const parts: string[] = [];
  if (details.lengthSeconds !== undefined) {
    const m = Math.floor(details.lengthSeconds / 60);
    const sec = String(details.lengthSeconds % 60).padStart(2, "0");
    parts.push(`${m}:${sec} long`);
  }
  if (details.graphics !== undefined) parts.push(plural(details.graphics, "graphic", "graphics"));
  if (details.quickbooksScreens !== undefined) parts.push(plural(details.quickbooksScreens, "QuickBooks screen", "QuickBooks screens"));
  return parts.length > 0 ? parts.join(" · ") : null;
}

function Steps({ video }: { video: VideoCard }) {
  if (!video.steps) return <p className="mt-1 text-slate-600">{video.stage ?? "On its way to ripley"}</p>;
  return (
    <ol className="mt-2 space-y-1">
      {video.steps.map((step) => (
        <li key={step.label} className={TONE[step.state]}>
          <span className="mr-2 inline-block w-4">{MARK[step.state]}</span>
          {step.label}
          {step.state === "stopped" && step.message ? <p className="ml-6 text-sm">{step.message}</p> : null}
          {step.state === "now" && video.render?.total !== undefined ? (
            <div className="ml-6 font-normal">
              {video.render.piece && video.render.pieces ? (
                <Bar
                  label={`${video.render.pieceLabel ?? "Piece"} ${video.render.piece} of ${video.render.pieces}`}
                  share={video.render.pieceShare ?? 0}
                />
              ) : null}
              {video.render.pieceName ? <p className="mt-1 text-sm text-slate-500">Now: {video.render.pieceName}</p> : null}
              <Bar label="Whole video" share={video.render.total} />
              {video.render.minutesLeft ? <p className="mt-1 text-sm text-slate-500">About {video.render.minutesLeft} min left</p> : null}
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/**
 * Every video ripley is making, full width: the YouTube title once written, the steps and render
 * bars on the left, the thumbnail and details on the right (stacked on a phone). Refreshes itself.
 */
export function VideosInProgress({ videos }: { videos: VideoCard[] }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(timer);
  }, [router]);

  if (videos.length === 0) return null;
  return (
    <section className="mt-6 flex flex-col gap-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Videos in progress</h2>
      {videos.map((video) => {
        const details = detailLine(video.details);
        return (
          <div key={video.batch} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
              <div className="min-w-0">
                <p className="text-lg font-semibold leading-snug text-slate-900">{video.title ?? video.project ?? "New video"}</p>
                {video.title && video.project ? <p className="mt-0.5 text-xs text-slate-500">{video.project}</p> : null}
                {video.url ? <p className="mt-2 font-semibold text-green-700">Published on YouTube</p> : <Steps video={video} />}
              </div>
              <div className={video.thumbnail || details || video.url ? "min-w-0" : "hidden md:block"}>
                {video.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element -- inline data: JPEG from ripley
                  <img src={video.thumbnail} alt="" className="aspect-video w-full rounded-xl object-cover" />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-400">
                    Thumbnail not made yet
                  </div>
                )}
                {details ? <p className="mt-2 text-sm text-slate-600">{details}</p> : null}
                {video.url ? (
                  <a href={video.url} target="_blank" rel="noopener" className="mt-3 inline-flex rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">
                    Watch on YouTube
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { VideoRender, VideoStep } from "@/lib/showrunner/video-status";

export type VideoCard = {
  batch: string;
  project: string | null;
  state: string;
  stage: string | null;
  steps: VideoStep[] | null;
  render: VideoRender | null;
  url: string | null;
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

/** Every video ripley is making: its 11 steps, the render bars, then the YouTube link. Refreshes itself. */
export function VideosInProgress({ videos }: { videos: VideoCard[] }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(timer);
  }, [router]);

  if (videos.length === 0) return null;
  return (
    <section className="mt-6 flex max-w-xl flex-col gap-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Videos in progress</h2>
      {videos.map((video) => (
        <div key={video.batch} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-lg font-semibold text-slate-900">{video.project ?? "New video"}</p>
          {video.url ? (
            <>
              <p className="mt-1 font-semibold text-green-700">Published on YouTube</p>
              <a href={video.url} target="_blank" rel="noopener" className="mt-3 inline-flex rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">
                Watch on YouTube
              </a>
            </>
          ) : video.steps ? (
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
                      {video.render.pieceName ? (
                        <p className="mt-1 text-sm text-slate-500">Now: {video.render.pieceName}</p>
                      ) : null}
                      <Bar label="Whole video" share={video.render.total} />
                      {video.render.minutesLeft ? <p className="mt-1 text-sm text-slate-500">About {video.render.minutesLeft} min left</p> : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-1 text-slate-600">{video.stage ?? "On its way to ripley"}</p>
          )}
        </div>
      ))}
    </section>
  );
}

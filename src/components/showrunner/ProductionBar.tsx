"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { requestFinish } from "@/app/(app)/showrunner/editor/actions";
import { episodeHref, type ProductionItem } from "@/lib/showrunner/production";

/**
 * One thin row on every page while ripley is making a video (Tom, 2026-11-25): the step it is on and a progress
 * bar; tap for that video's production page. Hidden when nothing is in production. Laid out like DonnaCleanBar.
 */
export function ProductionBar() {
  const pathname = usePathname();
  const [videos, setVideos] = useState<ProductionItem[]>([]);

  useEffect(() => {
    let stopped = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      if (document.visibilityState === "visible") {
        try {
          const response = await fetch("/api/showrunner/production", { cache: "no-store" });
          if (response.ok) {
            const body = (await response.json()) as { videos?: ProductionItem[] };
            const next = body.videos ?? [];
            running = next.length > 0;
            if (!stopped) setVideos(next);
          }
        } catch {
          // Offline for a moment: keep the last bar.
        }
      }
      if (!stopped) timer = setTimeout(poll, running ? 4_000 : 10_000);
    }
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [pathname]);

  const video = videos[0];
  if (!video) return null;
  const href = episodeHref(video.batch);
  const pct = Math.floor(video.progress * 100);
  const countLabel = video.step && video.steps ? `${video.step} of ${video.steps}` : null;
  const extra = videos.length > 1 ? `+${videos.length - 1} more` : null;
  const aria = [
    video.name,
    video.stopped ? `Stopped: ${video.label}` : video.label,
    countLabel,
    extra,
    `${pct}%`,
  ]
    .filter(Boolean)
    .join(". ");
  const track = video.stopped ? "bg-rose-600" : video.waiting ? "bg-amber-500" : "bg-slate-600";
  const dot = video.stopped ? "bg-rose-600" : video.waiting ? "bg-amber-500" : "animate-pulse bg-slate-500";
  const control = "rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-100";
  return (
    <div className="relative flex shrink-0 items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-1">
      <Link
        href={href}
        aria-current={pathname === href ? "page" : undefined}
        className="flex min-w-0 flex-1 items-center gap-2 text-xs hover:opacity-80"
        aria-label={`${aria}. Open production details.`}
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
        <span className="shrink-0 text-slate-700">{video.name}</span>
        <span
          className={`min-w-0 flex-1 truncate ${video.stopped ? "font-semibold text-rose-700" : video.waiting ? "font-semibold text-amber-800" : "text-slate-500"}`}
        >
          · {video.stopped ? "Stopped: " : ""}
          {video.label}
          {countLabel ? ` · ${countLabel}` : ""}
          {extra ? ` · ${extra}` : ""}
        </span>
        <span className="shrink-0 font-semibold tabular-nums text-slate-900">{pct}%</span>
      </Link>
      <Link href={`/phone?addTo=${encodeURIComponent(video.batch)}`} className={control}>
        Add clips
      </Link>
      {video.waiting ? (
        <form action={requestFinish}>
          <input type="hidden" name="batch" value={video.batch} />
          <button type="submit" className={control}>
            Finish
          </button>
        </form>
      ) : null}
      {video.finishing ? <span className="shrink-0 text-xs text-slate-600">Starting…</span> : null}
      <span className="absolute inset-x-0 bottom-0 block h-0.5 bg-slate-200" aria-hidden="true">
        <span className={`block h-0.5 ${track}`} style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

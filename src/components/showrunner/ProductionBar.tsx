"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ProductionItem } from "@/lib/showrunner/production";

/**
 * One thin row on every page while ripley is making a video (Tom, 2026-11-25): the step it is on and a progress
 * bar; tap for that video's production page. Hidden when nothing is in production.
 */
export function ProductionBar() {
  const pathname = usePathname();
  const [videos, setVideos] = useState<ProductionItem[]>([]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      if (document.visibilityState === "visible") {
        try {
          const response = await fetch("/api/showrunner/production", { cache: "no-store" });
          if (response.ok) {
            const body = (await response.json()) as { videos?: ProductionItem[] };
            if (!stopped) setVideos(body.videos ?? []);
          }
        } catch {
          // Offline for a moment: keep the last bar.
        }
      }
      if (!stopped) timer = setTimeout(poll, 10_000);
    }
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  const video = videos[0];
  if (!video) return null;
  const href = `/showrunner/production/${encodeURIComponent(video.batch)}`;
  const pct = Math.floor(video.progress * 100);
  return (
    <Link
      href={href}
      aria-current={pathname === href ? "page" : undefined}
      className="block shrink-0 border-b border-slate-200 bg-white px-4 py-1.5 hover:bg-slate-50"
      aria-label={`${video.name}: ${video.label}, ${pct}% done. Open production details.`}
    >
      <span className="flex items-center gap-2 text-xs">
        <span className={`h-2 w-2 shrink-0 rounded-full ${video.stopped ? "bg-rose-600" : "animate-pulse bg-[#ff0000]"}`} aria-hidden="true" />
        <span className={`min-w-0 flex-1 truncate ${video.stopped ? "font-semibold text-rose-700" : "text-slate-700"}`}>
          {video.stopped ? "Stopped: " : ""}
          {video.label}
          {video.step && video.steps ? <span className="text-slate-400"> · {video.step} of {video.steps}</span> : null}
          {videos.length > 1 ? <span className="text-slate-400"> · +{videos.length - 1} more</span> : null}
        </span>
        <span className="shrink-0 font-semibold tabular-nums text-slate-900">{pct}%</span>
      </span>
      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
        <span className={`block h-1 rounded-full ${video.stopped ? "bg-rose-600" : "bg-[#ff0000]"}`} style={{ width: `${pct}%` }} />
      </span>
    </Link>
  );
}

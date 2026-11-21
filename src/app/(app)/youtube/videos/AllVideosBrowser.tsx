"use client";

import { useMemo, useState } from "react";
import { VideoList, type VideoListItem } from "../VideoList";
import { VIEW_COOKIE, type View } from "./view";

type Sort = "newest" | "views" | "watched";

const SORTS: { id: Sort; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "views", label: "Most viewed" },
  { id: "watched", label: "Best % watched" },
];

function Toggle({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  return (
    <div className="inline-flex rounded-full border border-slate-300 bg-white p-0.5 text-sm font-semibold">
      {(["detailed", "condensed"] as const).map((id) => (
        <button
          key={id}
          type="button"
          aria-pressed={view === id}
          onClick={() => onChange(id)}
          className={`rounded-full px-3.5 py-1.5 capitalize ${view === id ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`}
        >
          {id}
        </button>
      ))}
    </div>
  );
}

/** All videos with a Detailed / Condensed switch (remembered on this device), a title search and a sort. */
export function AllVideosBrowser({ videos, initialView }: { videos: VideoListItem[]; initialView: View }) {
  const [view, setView] = useState<View>(initialView);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("newest");

  function changeView(next: View) {
    setView(next);
    document.cookie = `${VIEW_COOKIE}=${next}; path=/youtube; max-age=31536000; samesite=lax`;
  }

  const shown = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = videos.filter((v) => words.every((word) => v.title.toLowerCase().includes(word)));
    if (sort === "views") return [...matches].sort((a, b) => b.views - a.views);
    if (sort === "watched") return [...matches].sort((a, b) => b.averageViewPercentage - a.averageViewPercentage);
    return matches; // already newest first
  }, [videos, query, sort]);

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search titles"
          aria-label="Search titles"
          className="min-w-0 flex-1 basis-48 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none"
        />
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as Sort)}
          aria-label="Sort videos"
          className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        >
          {SORTS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {shown.length === videos.length ? `${videos.length} videos` : `${shown.length} of ${videos.length} videos`}
        </p>
        <Toggle view={view} onChange={changeView} />
      </div>
      <div className="mt-2 rounded-xl border border-slate-200 bg-white px-5 py-1">
        <VideoList
          videos={shown}
          condensed={view === "condensed"}
          empty={videos.length === 0 ? "No videos on this channel yet." : "No titles match that search."}
        />
      </div>
    </>
  );
}

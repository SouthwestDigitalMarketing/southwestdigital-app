"use client";

import { requestVisibility } from "@/app/(app)/showrunner/editor/actions";
import type { YoutubeVisibility } from "@/lib/showrunner/video-status";

const OPTIONS = [
  { value: "private", label: "Private" },
  { value: "unlisted", label: "Unlisted" },
  { value: "public", label: "Public" },
] as const;

/** Three full-width privacy choices for a video already on YouTube. */
export function YouTubeVisibility({
  batch,
  visibility,
  busy,
}: {
  batch: string;
  visibility: YoutubeVisibility | null;
  busy?: boolean;
}) {
  return (
    <div className="mt-3">
      {busy ? <p className="mb-2 text-sm text-slate-700">Changing visibility on YouTube.</p> : null}
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((option) => {
          const current = visibility === option.value;
          return (
            <form action={requestVisibility} key={option.value}>
              <input type="hidden" name="batch" value={batch} />
              <input type="hidden" name="visibility" value={option.value} />
              <button
                type="submit"
                disabled={busy || current}
                className={
                  current
                    ? "w-full rounded-full bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-90"
                    : "w-full rounded-full border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 disabled:opacity-60"
                }
              >
                {option.label}
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}

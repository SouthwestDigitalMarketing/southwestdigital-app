"use client";

import { approveTitleScreen } from "@/app/(app)/showrunner/editor/actions";

/** Open-card still on the episode page. Daily cards share a format; weekly ones are custom. */
export function TitleScreen({
  batch,
  image,
  kind,
  day,
  approvedAt,
}: {
  batch: string;
  image: string | null;
  kind: "daily" | "series" | null;
  day: number | null;
  approvedAt?: Date | string | null;
}) {
  const approved = Boolean(approvedAt);
  return (
    <div className="mt-4">
      <p className="text-sm font-semibold text-slate-900">Title screen</p>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- inline data: JPEG from ripley
        <img src={image} alt="Title screen" className="mt-2 aspect-video w-full rounded-xl object-cover" />
      ) : (
        <div className="mt-2 flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-400">
          Title screen not drawn yet
        </div>
      )}
      {kind === "daily" ? (
        <p className="mt-2 text-sm text-slate-700">
          {typeof day === "number" ? `Day ${day}. ` : null}
          Same card each day — only the number changes.
        </p>
      ) : kind === "series" ? (
        <p className="mt-2 text-sm text-slate-700">Weekly series open — custom for this episode.</p>
      ) : (
        <p className="mt-2 text-sm text-slate-600">The card that plays at the start of the video.</p>
      )}
      {approved ? (
        <p className="mt-2 text-sm font-semibold text-green-700">Title screen approved</p>
      ) : image ? (
        <form action={approveTitleScreen} className="mt-2">
          <input type="hidden" name="batch" value={batch} />
          <button type="submit" className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">
            Approve this title screen
          </button>
        </form>
      ) : null}
    </div>
  );
}

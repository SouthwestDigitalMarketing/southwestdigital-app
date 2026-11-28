"use client";

import { useState } from "react";
import { requestThumbnailText } from "@/app/(app)/showrunner/editor/actions";

function sameWording(a: string, b: string) {
  return a.replace(/\s*\/\s*/g, " ").trim().toUpperCase() === b.replace(/\s*\/\s*/g, " ").trim().toUpperCase();
}

/** Current wording is already in use (matches the graphic). Alternatives stay hidden until Tom wants a change. */
export function ThumbnailCopy({
  batch,
  thumbnailText,
  thumbnailOptions,
  busy,
  published = false,
}: {
  batch: string;
  thumbnailText: string | null;
  thumbnailOptions: string[] | null;
  busy: boolean;
  published?: boolean;
}) {
  const options = thumbnailOptions ?? [];
  const current = thumbnailText ?? "";
  const display = current.replace(/\s*\/\s*/g, " ");
  const listed = options.some((option) => sameWording(option, current));
  const [choice, setChoice] = useState(
    listed ? options.find((option) => sameWording(option, current)) ?? options[0] ?? "custom" : "custom",
  );
  const [custom, setCustom] = useState(listed ? "" : display);

  if (options.length === 0 && !current && !busy) return null;
  if (busy) {
    return (
      <p className="mt-3 text-sm text-slate-700">
        Remaking the thumbnail{display ? ` with ${display}` : ""}.
        {published ? " YouTube will get the new picture." : " The video keeps rendering."}
      </p>
    );
  }
  return (
    <div className="mt-3">
      {display ? (
        <p className="text-sm text-slate-700">
          <span className="font-semibold text-slate-900">{display}</span>
          {published ? " — that's what's on YouTube." : " — that's what's on the thumbnail."}
        </p>
      ) : (
        <p className="text-sm text-slate-600">Thumbnail wording is still being written.</p>
      )}
      <details className="mt-1">
        <summary className="cursor-pointer text-sm font-semibold text-slate-600">Use different wording</summary>
        <form action={requestThumbnailText} className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <input type="hidden" name="batch" value={batch} />
          <p className="text-sm text-slate-600">
            {published
              ? "This wording is already on YouTube. A new choice remakes the picture and updates it there."
              : "This wording is already on the thumbnail. A new choice remakes the picture; the video keeps rendering."}
          </p>
          {choice !== "custom" ? <input type="hidden" name="text" value={choice} /> : <input type="hidden" name="custom" value={custom} />}
          <ul className="mt-2 space-y-1.5">
            {options.map((option) => (
              <li key={option}>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-800">
                  <input type="radio" checked={choice === option} onChange={() => setChoice(option)} className="mt-0.5" />
                  <span>
                    {option}
                    {current && sameWording(option, current) ? (
                      <span className="ml-1 text-xs font-semibold uppercase tracking-wide text-slate-500">on the thumbnail</span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
            <li>
              <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-800">
                <input type="radio" checked={choice === "custom"} onChange={() => setChoice("custom")} className="mt-0.5" />
                <span className="min-w-0 flex-1">
                  Write your own
                  <input
                    value={custom}
                    onChange={(event) => {
                      setCustom(event.target.value);
                      setChoice("custom");
                    }}
                    maxLength={60}
                    placeholder="THREE YEARS CLEAN"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </span>
              </label>
            </li>
          </ul>
          <button type="submit" className="mt-3 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">
            Remake thumbnail
          </button>
        </form>
      </details>
    </div>
  );
}

export function TranscriptAccordion({ transcript }: { transcript: string | null }) {
  if (!transcript) return null;
  return (
    <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-slate-900">Transcript</summary>
      <pre className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
        {transcript}
      </pre>
    </details>
  );
}

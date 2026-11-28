"use client";

import { useState } from "react";
import { requestTeaser, requestThumbnailText } from "@/app/(app)/showrunner/editor/actions";
import type { Teaser, TranscriptCue } from "@/lib/showrunner/video-status";

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

function selectedRange(root: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;
  const hits = [...root.querySelectorAll<HTMLElement>("[data-start]")].filter((el) => {
    try {
      return range.intersectsNode(el);
    } catch {
      return false;
    }
  });
  if (!hits.length) return null;
  return {
    start: Math.min(...hits.map((el) => Number(el.dataset.start))),
    end: Math.max(...hits.map((el) => Number(el.dataset.end))),
  };
}

function cueInTeaser(cue: TranscriptCue, teaser: Teaser | null, draft: { start: number; end: number } | null) {
  const span =
    draft ??
    (teaser?.wanted && teaser.start != null && teaser.end != null ? { start: teaser.start, end: teaser.end } : null);
  if (!span) return false;
  return cue.end > span.start && cue.start < span.end;
}

/** Transcript with Johnny's teaser highlighted. Highlight another stretch to change it, or start on the title. */
export function TranscriptAccordion({
  batch,
  transcript,
  cues,
  teaser,
  busy,
  published = false,
}: {
  batch: string;
  transcript: string | null;
  cues?: TranscriptCue[] | null;
  teaser?: Teaser | null;
  busy?: boolean;
  published?: boolean;
}) {
  const [draft, setDraft] = useState<{ start: number; end: number } | null>(null);
  if (!transcript && !cues?.length) return null;
  const timed = cues && cues.length > 0;
  const draftText = draft && timed ? cues.filter((cue) => cue.end > draft.start && cue.start < draft.end).map((cue) => cue.text).join(" ") : "";
  return (
    <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3" open={Boolean(timed && teaser)}>
      <summary className="cursor-pointer text-sm font-semibold text-slate-900">Transcript</summary>
      {busy ? (
        <p className="mt-3 text-sm text-slate-700">
          Remaking the opening.{published ? " YouTube will get the new cut." : " The rest of the video stays as it is."}
        </p>
      ) : null}
      {timed && !busy ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <form action={requestTeaser}>
            <input type="hidden" name="batch" value={batch} />
            <input type="hidden" name="wanted" value="false" />
            <button
              type="submit"
              className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm font-semibold text-slate-800"
            >
              {teaser?.wanted === false ? "Starts on the title" : "Start on the title — no teaser"}
            </button>
          </form>
          {teaser?.wanted === false && teaser.start != null && teaser.end != null ? (
            <form action={requestTeaser}>
              <input type="hidden" name="batch" value={batch} />
              <input type="hidden" name="wanted" value="true" />
              <input type="hidden" name="start" value={teaser.start} />
              <input type="hidden" name="end" value={teaser.end} />
              <button type="submit" className="rounded-full bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white">
                Put the teaser back
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
      {timed && !busy ? (
        <p className="mt-2 text-sm text-slate-600">
          {teaser?.wanted === false
            ? "This video starts on the title. Highlight words below if you want a teaser before it."
            : "Yellow is the teaser before the title. Highlight other words to change it."}
        </p>
      ) : null}
      {timed ? (
        <p
          className="mt-3 max-h-80 overflow-y-auto font-sans text-sm leading-relaxed text-slate-700"
          onMouseUp={(event) => setDraft(selectedRange(event.currentTarget))}
          onTouchEnd={(event) => setDraft(selectedRange(event.currentTarget))}
        >
          {cues.map((cue, index) => (
            <span
              key={`${cue.start}-${index}`}
              data-start={cue.start}
              data-end={cue.end}
              className={cueInTeaser(cue, teaser ?? null, draft) ? "rounded-sm bg-amber-200" : undefined}
            >
              {cue.text}
              {index < cues.length - 1 ? " " : ""}
            </span>
          ))}
        </p>
      ) : (
        <pre className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
          {transcript}
        </pre>
      )}
      {timed && draft && !busy ? (
        <form action={requestTeaser} className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <input type="hidden" name="batch" value={batch} />
          <input type="hidden" name="wanted" value="true" />
          <input type="hidden" name="start" value={draft.start} />
          <input type="hidden" name="end" value={draft.end} />
          <p className="text-sm text-slate-800">{draftText}</p>
          <button type="submit" className="mt-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">
            Use this as the teaser
          </button>
        </form>
      ) : null}
    </details>
  );
}

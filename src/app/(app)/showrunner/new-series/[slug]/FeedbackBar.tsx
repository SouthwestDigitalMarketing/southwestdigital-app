"use client";

import { useState, useTransition } from "react";
import { saveShowrunnerFeedback } from "../../actions";
import { REACTION_LABEL, type LatestFeedback, type Reaction } from "@/lib/showrunner/feedback";

const button = "rounded-full border px-4 py-2 text-sm font-semibold";

export function FeedbackBar({
  seriesSlug,
  episodeIndex,
  latest,
}: {
  seriesSlug: string;
  episodeIndex: number | null;
  latest?: LatestFeedback;
}) {
  const [saved, setSaved] = useState<LatestFeedback | undefined>(latest);
  const [writing, setWriting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function send(reaction: Reaction, text: string | null) {
    setError(null);
    start(async () => {
      try {
        await saveShowrunnerFeedback({ seriesSlug, episodeIndex, reaction, note: text });
        setSaved({ reaction, note: text });
        setWriting(false);
        setNote("");
      } catch {
        setError("Could not save. Try again.");
      }
    });
  }

  const chip = (reaction: Reaction) =>
    saved?.reaction === reaction ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-900";

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => send("like", null)} className={`${button} ${chip("like")}`}>Like</button>
        <button type="button" disabled={pending} onClick={() => send("drop", null)} className={`${button} ${chip("drop")}`}>Drop</button>
        <button type="button" disabled={pending} onClick={() => setWriting(true)} className={`${button} ${chip("change")}`}>Change</button>
      </div>
      {writing ? (
        <div className="mt-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="What should change? Talk or type."
            className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900"
          />
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={pending || note.trim().length === 0} onClick={() => send("change", note)} className={`${button} border-slate-900 bg-slate-900 text-white disabled:opacity-50`}>Send</button>
            <button type="button" onClick={() => setWriting(false)} className={`${button} border-slate-300 bg-white text-slate-900`}>Cancel</button>
          </div>
        </div>
      ) : null}
      {saved ? (
        <p className="mt-2 text-sm text-slate-600">
          {REACTION_LABEL[saved.reaction]}
          {saved.note ? `: ${saved.note}` : ""}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

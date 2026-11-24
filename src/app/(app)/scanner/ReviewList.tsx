"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitReview } from "./reviewActions";

export type ReviewRowView = {
  id: string;
  title: string;
  detail: string;
  note: string | null;
  defaultAnswer: string;
};

type Labels = Record<string, { word: string; className: string }>;

/** One numbered line per item; tapping a line flips its answer. Done sends
 * every line on screen (defaults plus flips) to ripley. */
export function ReviewList({
  review,
  rows,
  labels,
  hint,
  doneLabel,
}: {
  review: "spam" | "newsletter";
  rows: ReviewRowView[];
  labels: Labels;
  hint: string;
  doneLabel: string;
}) {
  const router = useRouter();
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const answers = Object.keys(labels);
  const answerOf = (row: ReviewRowView) =>
    flipped.has(row.id) ? answers.find((a) => a !== row.defaultAnswer) ?? row.defaultAnswer : row.defaultAnswer;
  const totals = answers.map((answer) => ({ answer, n: rows.filter((row) => answerOf(row) === answer).length }));

  function toggle(id: string) {
    setFlipped((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function done() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await submitReview(review, rows.map((row) => row.id), [...flipped]);
        setMessage(result.message);
        setFlipped(new Set());
        router.refresh();
      } catch {
        setMessage("Could not save the answers. Nothing was changed; try again.");
      }
    });
  }

  return (
    <div>
      <p className="mt-2 text-sm text-slate-600">{hint}</p>
      <ol className="mt-4 space-y-1 text-sm">
        {rows.map((row, index) => {
          const answer = answerOf(row);
          const label = labels[answer];
          return (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => toggle(row.id)}
                aria-pressed={flipped.has(row.id)}
                className="flex w-full min-w-0 items-baseline gap-2 rounded-md px-1 py-1.5 text-left hover:bg-slate-50"
              >
                <span className="w-7 shrink-0 text-right tabular-nums text-slate-400">{index + 1}.</span>
                <span className="min-w-0 flex-1 break-words">
                  <span className="text-slate-900">{row.title}</span>
                  <span className="text-slate-500"> — {row.detail}</span>
                  {row.note ? <span className="block text-xs text-slate-500">{row.note}</span> : null}
                </span>
                <span className={`shrink-0 text-xs font-medium ${label?.className ?? "text-slate-500"}`}>{label?.word ?? answer}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="sticky bottom-0 mt-4 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white py-3">
        <p className="min-w-0 flex-1 text-sm text-slate-600">
          {totals.map((t) => `${t.n} ${labels[t.answer]?.word.toLowerCase() ?? t.answer}`).join(" · ")}
        </p>
        <button
          type="button"
          onClick={done}
          disabled={pending || rows.length === 0}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : doneLabel}
        </button>
      </div>
      {message ? <p className="mt-2 text-sm text-slate-700" role="status">{message}</p> : null}
    </div>
  );
}

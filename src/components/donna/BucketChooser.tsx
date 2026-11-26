"use client";

import { useState } from "react";
import type { Bucket } from "@/lib/donna/domain";

/**
 * Step 1's gate: every bucket with a choice (default Leave in Inbox) and its emails,
 * each ticked. A live line says exactly what step 2 will move before Tom starts it.
 */
export function BucketChooser({
  jobId,
  buckets,
  folders,
  blocked,
  action,
}: {
  jobId: string;
  buckets: Bucket[];
  /** STEP_FOLDERS, passed in so this client file does not import server code. */
  folders: readonly string[];
  blocked: string | null;
  action: (form: FormData) => Promise<void>;
}) {
  const [summary, setSummary] = useState<[string, number][]>([]);

  function recount(form: HTMLFormElement) {
    const data = new FormData(form);
    const ticked = new Set(data.getAll("thread").map(String));
    const counts = new Map<string, number>();
    buckets.forEach((bucket, i) => {
      const choice = String(data.get(`bucket-${i}`) ?? "leave");
      if (choice === "leave") return;
      const n = bucket.items.filter((item) => ticked.has(item.thread)).length;
      if (n) counts.set(choice, (counts.get(choice) ?? 0) + n);
    });
    setSummary([...counts]);
  }

  const moving = summary.reduce((n, [, c]) => n + c, 0);
  return (
    <form
      action={action}
      onChange={(e) => recount(e.currentTarget)}
      className="space-y-4"
    >
      <input type="hidden" name="jobId" value={jobId} />
      {buckets.map((bucket, i) => (
        <section
          key={bucket.name}
          className="space-y-2 rounded-xl border border-slate-200 bg-white p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold">
                {bucket.name}{" "}
                <span className="font-normal tabular-nums text-slate-400">
                  {bucket.items.length}
                </span>
              </h3>
              <p className="text-xs text-slate-500">{bucket.note}</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <span className="sr-only">What to do with {bucket.name}</span>
              <select
                name={`bucket-${i}`}
                defaultValue="leave"
                className="rounded-md border border-slate-200 px-2 py-1"
              >
                <option value="leave">Leave in Inbox</option>
                {bucket.suggest ? (
                  <option value={bucket.suggest}>
                    Move to {bucket.suggest} (Donna suggests)
                  </option>
                ) : null}
                {folders.filter((f) => f !== bucket.suggest).map((f) => (
                  <option key={f} value={f}>
                    Move to {f}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <details open={bucket.items.length <= 8}>
            <summary className="cursor-pointer text-xs text-slate-500">
              {bucket.items.length === 1
                ? "The email"
                : `The ${bucket.items.length} emails`}
              , each with Donna’s reason. Untick one to leave it in Inbox.
            </summary>
            <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-100">
              {bucket.items.map((item) => (
                <li key={item.thread}>
                  <label className="flex items-start gap-3 px-3 py-2">
                    <input
                      type="checkbox"
                      name="thread"
                      value={item.thread}
                      defaultChecked
                      className="mt-1 h-4 w-4 shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        {item.subject}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {[item.from, item.client].filter(Boolean).join(" · ")}
                      </span>
                      {item.why ? (
                        <span className="block text-xs text-slate-600">
                          Why: {item.why}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </details>
        </section>
      ))}
      <section className="sticky bottom-0 space-y-2 rounded-xl border border-slate-300 bg-white p-4 text-sm shadow-sm">
        <h3 className="font-semibold">Step 2: Do what I chose</h3>
        <p className="text-slate-700">
          {moving
            ? `Step 2 will move ${moving}: ${summary.map(([f, n]) => `${n} to ${f}`).join(", ")}. Everything else stays in Inbox.`
            : "Nothing is set to move. Pick a folder for a bucket above to move it."}
        </p>
        <p className="text-xs text-slate-500">
          Nothing has moved yet. Emails that change before step 2 reaches them
          stay in Inbox. Every move can be undone afterwards.
        </p>
        {blocked ? (
          <p className="text-xs text-amber-700">{blocked}</p>
        ) : (
          <button
            type="submit"
            disabled={!moving}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-white disabled:opacity-40"
          >
            Start step 2
          </button>
        )}
      </section>
    </form>
  );
}

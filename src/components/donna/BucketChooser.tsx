"use client";

import { useState } from "react";
import type { Bucket } from "@/lib/donna/domain";
import { EmailCells, EmailHeads, rowTint, td, th } from "./sortTable";

/**
 * Step 2, Choose (Tom's turn): the sorted table with a choice per bucket on its first
 * row (default Leave in Inbox) and a tick per email. A live line says exactly what
 * step 3 will do before Tom starts it.
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
    const add = (what: string, n: number) =>
      n && counts.set(what, (counts.get(what) ?? 0) + n);
    buckets.forEach((bucket, i) => {
      const choice = String(data.get(`bucket-${i}`) ?? "leave");
      if (choice === "leave") return;
      const tagging = choice === "tag" || choice.startsWith("tag:");
      const folder = tagging ? choice.slice(4) : choice;
      const items = bucket.items.filter(
        (item) => ticked.has(item.thread) && (!tagging || item.client),
      );
      if (tagging) add("tag with the client name", items.length);
      if (folder) add(`move to ${folder}`, items.length);
    });
    setSummary([...counts]);
  }

  const moving = summary.reduce((n, [, c]) => n + c, 0);
  const named = (bucket: Bucket) => bucket.items.filter((i) => i.client).length;
  return (
    <form
      action={action}
      onChange={(e) => recount(e.currentTarget)}
      className="space-y-3"
    >
      <input type="hidden" name="jobId" value={jobId} />
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table
          aria-label="Choose what to do"
          className="w-full min-w-[760px] text-left text-xs"
        >
          <thead className="uppercase tracking-wide text-slate-500">
            <tr className="border-b border-slate-200">
              <th className={`w-6 ${th}`}>
                <span className="sr-only">Include</span>
              </th>
              <th className={th}>Bucket and choice</th>
              <EmailHeads />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {buckets.flatMap((bucket, b) =>
              bucket.items.map((item, i) => (
                <tr key={item.thread} className={`align-top ${rowTint(b, i)}`}>
                  <td className={td}>
                    <input
                      type="checkbox"
                      name="thread"
                      value={item.thread}
                      defaultChecked
                      aria-label={`Include ${item.subject}`}
                      className="mt-0.5 h-3.5 w-3.5"
                    />
                  </td>
                  <td className={`${td} font-medium`}>
                    {i ? null : (
                      <div className="space-y-1">
                        <div className="whitespace-nowrap">
                          {bucket.name} ({bucket.items.length})
                        </div>
                        <select
                          name={`bucket-${b}`}
                          defaultValue="leave"
                          aria-label={`What to do with ${bucket.name}`}
                          className="w-full max-w-[13rem] rounded border border-slate-300 bg-white px-1 py-0.5 font-normal"
                        >
                          <option value="leave">Leave in Inbox</option>
                          {named(bucket) ? (
                            <>
                              <option value="tag">Tag with client name</option>
                              <option value="tag:Archive">
                                Tag with client name, then Archive
                              </option>
                            </>
                          ) : null}
                          {bucket.suggest ? (
                            <option value={bucket.suggest}>
                              Move to {bucket.suggest} (Donna suggests)
                            </option>
                          ) : null}
                          {folders
                            .filter((f) => f !== bucket.suggest)
                            .map((f) => (
                              <option key={f} value={f}>
                                Move to {f}
                              </option>
                            ))}
                        </select>
                        {named(bucket) &&
                        named(bucket) < bucket.items.length ? (
                          <div className="font-normal text-amber-700">
                            {bucket.items.length - named(bucket)} without a
                            client name are not tagged
                          </div>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <EmailCells item={item} />
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm shadow-sm">
        <span className="min-w-0 flex-1 text-slate-700">
          {moving
            ? `Step 3 will ${summary.map(([what, n]) => `${what}: ${n}`).join("; ")}. Everything else stays as it is.`
            : "Nothing is set to change. Pick a choice for a bucket."}
        </span>
        {blocked ? (
          <span className="text-xs text-amber-700">{blocked}</span>
        ) : (
          <button
            type="submit"
            disabled={!moving}
            className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-40"
          >
            Start step 3
          </button>
        )}
      </div>
    </form>
  );
}

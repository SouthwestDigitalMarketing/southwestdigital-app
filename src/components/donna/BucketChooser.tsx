"use client";

import { useRef, useState } from "react";
import type { Bucket, SortedItem } from "@/lib/donna/domain";

// Mirrors JUNK/RESCUE in domain.ts (kept here so this client file imports no server code).
const RESCUE = "Rescue from Spam/Trash";
const LABELS: Record<string, string> = {
  leave: "Leave in Inbox",
  tag: "Tag client",
  "tag:Archive": "Tag client, then Archive",
  "spam-block": "Spam + block sender",
  spam: "Move to Spam",
  trash: "Move to Trash",
  inbox: "Back to Inbox",
  "inbox-never": "Back to Inbox + never block",
};
const SUMMARY: Record<string, string> = {
  "spam-block": "spam + block the sender",
  spam: "move to Spam",
  trash: "move to Trash",
  inbox: "put back in Inbox",
  "inbox-never": "put back in Inbox and never block",
};
import { EmailCells, EmailHeads, headTint, rowTint, td, th } from "./sortTable";

/** Donna's pick for one email (from step 1), else her folder, a client tag, or leave. */
function recommended(item: SortedItem) {
  if (item.action) return item.action;
  if (item.suggest) return item.suggest;
  if (item.client) return "tag";
  return "leave";
}

function Options({
  item,
  folders,
  donna,
}: {
  item: { client: string | null; bucket: string };
  folders: readonly string[];
  donna?: string;
}) {
  const mark = (value: string) => (value === donna ? " (Donna)" : "");
  const option = (value: string, label = LABELS[value]) => (
    <option key={value} value={value}>
      {label}
      {mark(value)}
    </option>
  );
  // Mail found in Spam or Trash: put it back, or leave it to be emptied.
  if (item.bucket === RESCUE)
    return (
      <>
        {option("inbox")}
        {option("inbox-never")}
        {option("leave", "Leave it there")}
      </>
    );
  return (
    <>
      {option("leave")}
      {item.client ? (
        <>
          {option("tag")}
          {option("tag:Archive")}
        </>
      ) : null}
      {option("spam-block")}
      {option("spam")}
      {option("trash")}
      {folders.map((f) => option(f, `Move to ${f}`))}
    </>
  );
}

const select =
  "w-full max-w-[14rem] rounded border border-slate-300 bg-white px-1 py-0.5";

/**
 * Step 2, Choose (Tom's turn). Every email has its own action, set to Donna's pick;
 * a ticked email will be done in step 3, an unticked one is left alone. Each bucket
 * has a header row: tick all, and set the ticked rows to one action at once.
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
  const form = useRef<HTMLFormElement>(null);
  const [summary, setSummary] = useState<[string, number][]>([]);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const all = buckets.flatMap((b) => b.items);

  function recount() {
    if (!form.current) return;
    const data = new FormData(form.current);
    const ticked = new Set(data.getAll("thread").map(String));
    const counts = new Map<string, number>();
    const add = (what: string) => counts.set(what, (counts.get(what) ?? 0) + 1);
    for (const item of all) {
      if (!ticked.has(item.thread)) continue;
      const choice = String(data.get(`choice-${item.thread}`) ?? "leave");
      if (SUMMARY[choice]) {
        add(SUMMARY[choice]);
        continue;
      }
      const tagging = choice === "tag" || choice.startsWith("tag:");
      const folder = tagging
        ? choice.slice(4)
        : choice === "leave"
          ? ""
          : choice;
      if (tagging && item.client) add("tag the client");
      if (folder) add(`move to ${folder}`);
    }
    setSummary([...counts]);
    setPicked(
      Object.fromEntries(
        buckets.map((b, i) => [
          i,
          b.items.filter((item) => ticked.has(item.thread)).length,
        ]),
      ),
    );
  }

  function rows(bucket: number) {
    return [
      ...(form.current?.querySelectorAll<HTMLInputElement>(
        `input[data-bucket="${bucket}"]`,
      ) ?? []),
    ];
  }

  function tickAll(bucket: number, on: boolean) {
    for (const box of rows(bucket)) box.checked = on;
    recount();
  }

  function applyTo(bucket: number) {
    const value = form.current?.querySelector<HTMLSelectElement>(
      `select[data-bulk="${bucket}"]`,
    )?.value;
    if (!value || !form.current) return;
    for (const box of rows(bucket)) {
      if (!box.checked) continue;
      const choice = form.current.querySelector<HTMLSelectElement>(
        `select[name="choice-${box.value}"]`,
      );
      // A client action only applies to emails that have a client name.
      if (
        choice &&
        [...choice.options].some((option) => option.value === value)
      )
        choice.value = value;
    }
    recount();
  }

  const doing = summary.reduce((n, [, c]) => n + c, 0);
  return (
    <form ref={form} action={action} onChange={recount} className="space-y-3">
      <input type="hidden" name="jobId" value={jobId} />
      <div className="donna-ui overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table
          aria-label="Choose what to do"
          className="donna-cards w-full min-w-[820px] text-left text-xs"
        >
          <thead className="uppercase tracking-wide text-slate-500">
            <tr className="border-b border-slate-200">
              <th className={`w-6 ${th}`}>
                <span className="sr-only">Do it</span>
              </th>
              <EmailHeads action />
            </tr>
          </thead>
          {buckets.map((bucket, b) => {
            const count = bucket.items.length;
            const ticked = picked[b] ?? 0;
            return (
              <tbody
                key={bucket.name}
                aria-label={`Bucket ${bucket.name}`}
                className="divide-y divide-slate-100"
              >
                <tr className={`border-t-2 border-t-slate-700 ${headTint(b)}`}>
                  <td data-cell="tick" className={td}>
                    <input
                      type="checkbox"
                      aria-label={`Select all in ${bucket.name}`}
                      checked={count > 0 && ticked === count}
                      ref={(el) => {
                        if (el) el.indeterminate = ticked > 0 && ticked < count;
                      }}
                      onChange={(e) => tickAll(b, e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5"
                    />
                  </td>
                  <td
                    data-cell="bucket"
                    colSpan={4}
                    className={`${td} text-sm font-semibold`}
                  >
                    {bucket.name} ({count})
                  </td>
                  <td data-cell="action" colSpan={2} className={td}>
                    <span className="flex items-center gap-1">
                      <select
                        data-bulk={b}
                        aria-label={`Set selected in ${bucket.name} to`}
                        defaultValue={recommended(bucket.items[0])}
                        className={select}
                      >
                        <Options
                          item={{
                            client: bucket.items.some((i) => i.client)
                              ? "yes"
                              : null,
                            bucket: bucket.name,
                          }}
                          folders={folders}
                        />
                      </select>
                      <button
                        type="button"
                        onClick={() => applyTo(b)}
                        disabled={!ticked}
                        className="rounded border border-slate-300 bg-white px-2 py-0.5 disabled:opacity-40"
                      >
                        Apply
                      </button>
                    </span>
                  </td>
                </tr>
                {bucket.items.map((item, i) => (
                  <tr
                    key={item.thread}
                    className={`align-top ${rowTint(b, i)}`}
                  >
                    <td data-cell="tick" className={td}>
                      <input
                        type="checkbox"
                        name="thread"
                        value={item.thread}
                        data-bucket={b}
                        aria-label={`Do ${item.subject}`}
                        className="mt-0.5 h-3.5 w-3.5"
                      />
                    </td>
                    <EmailCells
                      item={item}
                      action={
                        <select
                          name={`choice-${item.thread}`}
                          defaultValue={recommended(item)}
                          aria-label={`Action for ${item.subject}`}
                          className={select}
                        >
                          <Options
                            item={item}
                            folders={folders}
                            donna={recommended(item)}
                          />
                        </select>
                      }
                    />
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
      </div>
      <div className="sticky bottom-0 space-y-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="min-w-0 flex-1 text-slate-700">
            {doing
              ? `Step 3 will ${summary.map(([what, n]) => `${what}: ${n}`).join("; ")}. Unticked emails stay as they are.`
              : "Nothing ticked yet. Tick the emails (or a whole bucket) to do in step 3."}
          </span>
          {blocked ? (
            <span className="text-xs text-amber-700">{blocked}</span>
          ) : (
            <button
              type="submit"
              disabled={!doing}
              className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-40"
            >
              Start step 3
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

"use client";

import { useRef, useState } from "react";
import type { CleanupPlan, SpamSender } from "@/lib/donna/domain";
import { WhyCell, td, th } from "./sortTable";

const VERDICT: Record<SpamSender["verdict"], [string, string]> = {
  block: ["Spam", "text-rose-700"],
  keep: ["Maybe real", "text-emerald-700"],
  unsure: ["Not sure", "text-amber-700"],
};

/** Donna's verdict decides each sender's starting action. */
function startAction(sender: SpamSender) {
  if (sender.verdict === "block") return "block";
  if (sender.verdict === "keep") return "keep";
  return "leave";
}

const select =
  "w-full max-w-[13rem] rounded border border-slate-300 bg-white px-1 py-0.5";

/**
 * Step 4, Clean up (Tom, 2026-11-28). Spam is one row per sender with Donna's
 * verdict; Trash is one row. Block forever puts the sender on the always-spam
 * list; Not spam puts their mail back and never blocks them. Deleting needs the
 * Approve tick, which names exactly what goes.
 */
export function CleanupChooser({
  jobId,
  plan,
  blocked,
  action,
}: {
  jobId: string;
  plan: CleanupPlan;
  blocked: string | null;
  action: (form: FormData) => Promise<void>;
}) {
  const form = useRef<HTMLFormElement>(null);
  const initial = () => {
    const block = plan.spam.filter((s) => startAction(s) === "block");
    return {
      blocks: block.length,
      keeps: plan.spam.filter((s) => startAction(s) === "keep").length,
      spamDelete: block.reduce((n, s) => n + s.count, 0),
      trashDelete: 0,
    };
  };
  const [tally, setTally] = useState(initial);
  const [approved, setApproved] = useState(false);

  function recount() {
    if (!form.current) return;
    const data = new FormData(form.current);
    let blocks = 0;
    let keeps = 0;
    let spamDelete = 0;
    plan.spam.forEach((s, i) => {
      const choice = String(data.get(`sender-${i}`) ?? "leave");
      if (choice === "block") {
        blocks += 1;
        spamDelete += s.count;
      }
      if (choice === "keep") keeps += 1;
    });
    const trash = String(data.get("trash") ?? "leave");
    const trashDelete =
      trash === "all"
        ? plan.trash.total
        : trash === "older30"
          ? plan.trash.older30
          : 0;
    setTally({ blocks, keeps, spamDelete, trashDelete });
  }

  function setAll(value: string) {
    if (!form.current) return;
    for (const el of form.current.querySelectorAll<HTMLSelectElement>(
      "select[data-sender]",
    ))
      el.value = value;
    recount();
  }

  const deleting = tally.spamDelete + tally.trashDelete;
  const anything = tally.blocks + tally.keeps + tally.trashDelete > 0;
  const emails = (n: number) =>
    `${n.toLocaleString("en-US")} email${n === 1 ? "" : "s"}`;
  return (
    <form ref={form} action={action} onChange={recount} className="space-y-3">
      <input type="hidden" name="jobId" value={jobId} />
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table
          aria-label="Clean up Spam and Trash"
          className="w-full min-w-[760px] text-left text-xs"
        >
          <thead className="uppercase tracking-wide text-slate-500">
            <tr className="border-b border-slate-200">
              <th className={th}>Sender</th>
              <th className={th}>Emails</th>
              <th className={th}>Sample subjects</th>
              <th className={th}>Donna</th>
              <th className={th}>Action</th>
              <th className={`w-8 ${th}`}>
                <span className="sr-only">Why</span>
              </th>
            </tr>
          </thead>
          <tbody aria-label="Spam" className="divide-y divide-slate-100">
            <tr className="border-t-2 border-t-slate-700 bg-rose-50">
              <td colSpan={4} className={`${td} text-sm font-semibold`}>
                Spam ({plan.spam.length} senders,{" "}
                {emails(plan.spam.reduce((n, s) => n + s.count, 0))})
              </td>
              <td colSpan={2} className={td}>
                <select
                  aria-label="Set every Spam sender to"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) setAll(e.target.value);
                    e.target.value = "";
                  }}
                  className={select}
                >
                  <option value="">Set all to…</option>
                  <option value="block">Block forever</option>
                  <option value="keep">Not spam</option>
                  <option value="leave">Leave in Spam</option>
                </select>
              </td>
            </tr>
            {plan.spam.length ? (
              plan.spam.map((s, i) => (
                <tr
                  key={s.sender}
                  className={`align-top ${i % 2 ? "bg-rose-100/40" : "bg-white"}`}
                >
                  <td
                    className={`max-w-[14rem] truncate ${td}`}
                    title={s.sender}
                  >
                    <span className="font-medium">{s.name || s.sender}</span>
                    {s.name ? (
                      <span className="block truncate text-slate-500">
                        {s.sender}
                      </span>
                    ) : null}
                  </td>
                  <td className={`${td} tabular-nums`}>{s.count}</td>
                  <td className={`max-w-[18rem] truncate ${td} text-slate-600`}>
                    {s.samples.join(" · ")}
                  </td>
                  <td
                    className={`whitespace-nowrap ${td} ${VERDICT[s.verdict][1]}`}
                  >
                    {VERDICT[s.verdict][0]}
                  </td>
                  <td className={td}>
                    <select
                      name={`sender-${i}`}
                      data-sender
                      defaultValue={startAction(s)}
                      aria-label={`Action for ${s.sender}`}
                      className={select}
                    >
                      <option value="block">Block forever</option>
                      <option value="keep">Not spam: back to Inbox</option>
                      <option value="leave">Leave in Spam</option>
                    </select>
                  </td>
                  <td className={`${td} text-slate-400`}>
                    <WhyCell why={s.why} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className={`${td} text-slate-500`}>
                  Spam is empty.
                </td>
              </tr>
            )}
          </tbody>
          <tbody aria-label="Trash">
            <tr className="border-t-2 border-t-slate-700 bg-slate-100">
              <td colSpan={4} className={`${td} text-sm font-semibold`}>
                Trash ({emails(plan.trash.total)},{" "}
                {plan.trash.older30.toLocaleString("en-US")} older than 30 days)
              </td>
              <td colSpan={2} className={td}>
                <select
                  name="trash"
                  defaultValue="leave"
                  aria-label="What to do with Trash"
                  className={select}
                >
                  <option value="leave">Leave Trash as it is</option>
                  <option value="older30">Delete older than 30 days</option>
                  <option value="all">Delete all of Trash</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="sticky bottom-0 space-y-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm shadow-sm">
        <p className="text-slate-700">
          {anything
            ? [
                tally.blocks ? `block ${tally.blocks} senders forever` : "",
                tally.keeps
                  ? `put ${tally.keeps} senders back in Inbox and never block them`
                  : "",
                deleting ? `delete ${emails(deleting)}` : "",
              ]
                .filter(Boolean)
                .join("; ")
                .replace(/^./, (c) => `Clean up will ${c.toLowerCase()}`) + "."
            : "Nothing is set to change."}{" "}
          Senders left in Spam are not deleted.
        </p>
        {deleting ? (
          // Deleting cannot be undone: it needs Tom's own tick, naming what goes.
          <label className="flex items-start gap-2 rounded-lg bg-rose-50 px-2 py-1.5 text-rose-900">
            <input
              type="checkbox"
              name="approved"
              checked={approved}
              onChange={(e) => setApproved(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5"
            />
            <span>
              <span className="font-semibold">Approve:</span> permanently delete{" "}
              {emails(tally.spamDelete)} from the senders I block
              {tally.trashDelete
                ? ` and ${emails(tally.trashDelete)} from Trash`
                : ""}
              . This cannot be undone. Without this tick, blocked senders are
              blocked but nothing is deleted.
            </span>
          </label>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {blocked ? (
            <span className="text-xs text-amber-700">{blocked}</span>
          ) : (
            <button
              type="submit"
              disabled={
                !anything || (tally.blocks + tally.keeps === 0 && !approved)
              }
              className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-40"
            >
              Start clean up
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

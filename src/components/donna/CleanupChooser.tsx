"use client";

import { useRef, useState } from "react";
import type { CleanupPlan, SpamSender } from "@/lib/donna/domain";
import { EmailPreview } from "./EmailPreview";
import { WhyCell, headTint, rowTint, td, th } from "./sortTable";

const VERDICT: Record<SpamSender["verdict"], [string, string]> = {
  block: ["Spam", "text-rose-700"],
  keep: ["Looks real", "text-emerald-700"],
  unsure: ["Not sure", "text-amber-700"],
};

/** Sure spam starts as Spam; to check, real-looking mail starts as Not spam, the rest undecided. */
function startAction(sender: SpamSender) {
  if (sender.sure) return "spam";
  if (sender.verdict === "keep") return "keep";
  return "leave";
}

const select =
  "w-full max-w-[12rem] rounded border border-slate-300 bg-white px-1 py-0.5";

const WHERE: Record<string, string> = {
  INBOX: "Inbox",
  Spam: "Spam",
  Trash: "Trash",
};

type Row = { s: SpamSender; i: number };

/**
 * Step 4, Spam (Tom, 2026-11-28). Everything Donna found as spam, one row per
 * sender, in two buckets: Sure spam (scan it, all marked Spam) and Check these
 * (her reason up front; one choice each). Spam means: one-click unsubscribe when
 * it is safe, blocked in Zoho, mail moved to Trash. Not spam means: back to Inbox,
 * never blocked. Emptying Trash is a separate row with its own Approve tick.
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
  const indexed: Row[] = plan.spam.map((s, i) => ({ s, i }));
  const sure = indexed.filter(({ s }) => s.sure);
  const check = indexed.filter(({ s }) => !s.sure);
  const tallyFrom = (choice: (i: number) => string, trash: string) => {
    let spam = 0;
    let keep = 0;
    let emails = 0;
    let unsub = 0;
    let undecided = 0;
    plan.spam.forEach((s, i) => {
      const c = choice(i);
      if (c === "spam") {
        spam += 1;
        emails += s.where.includes("Trash") ? 0 : s.count;
        if (s.unsubscribe) unsub += 1;
      } else if (c === "keep") keep += 1;
      else undecided += 1;
    });
    const trashDelete =
      trash === "all"
        ? plan.trash.total
        : trash === "older30"
          ? plan.trash.older30
          : 0;
    return { spam, keep, emails, unsub, undecided, trashDelete };
  };
  const [tally, setTally] = useState(() =>
    tallyFrom((i) => startAction(plan.spam[i]), "leave"),
  );
  const [approved, setApproved] = useState(false);

  function recount() {
    if (!form.current) return;
    const data = new FormData(form.current);
    setTally(
      tallyFrom(
        (i) => String(data.get(`sender-${i}`) ?? "leave"),
        String(data.get("trash") ?? "leave"),
      ),
    );
  }

  function setGroup(group: string, value: string) {
    if (!form.current) return;
    for (const el of form.current.querySelectorAll<HTMLSelectElement>(
      `select[data-group="${group}"]`,
    ))
      el.value = value;
    recount();
  }

  const n = (x: number, one: string, many = `${one}s`) =>
    `${x.toLocaleString("en-US")} ${x === 1 ? one : many}`;
  const doing = tally.spam + tally.keep > 0 || tally.trashDelete > 0;

  const rows = (list: Row[], group: string, hue: number) =>
    list.length ? (
      list.map(({ s, i }, row) => (
        <tr key={s.sender} className={`align-top ${rowTint(hue, row)}`}>
          <td
            data-cell="subject"
            className={`max-w-[14rem] truncate ${td}`}
            title={s.sender}
          >
            <span className="font-medium">
              <EmailPreview
                subject={s.bodySubject || s.samples[0] || s.sender}
                from={s.name ? `${s.name} <${s.sender}>` : s.sender}
                body={s.body}
              >
                {s.name || s.sender}
              </EmailPreview>
            </span>
            {s.name ? (
              <span className="block truncate text-slate-500">{s.sender}</span>
            ) : null}
          </td>
          <td
            data-cell="count"
            data-label="Emails"
            className={`${td} tabular-nums`}
          >
            {s.count}
          </td>
          <td
            data-cell="where"
            data-label="In"
            className={`whitespace-nowrap ${td} text-slate-600`}
          >
            {s.where.map((w) => WHERE[w] ?? w).join(", ")}
          </td>
          <td
            data-cell="samples"
            className={`max-w-[16rem] truncate ${td} text-slate-600`}
          >
            {s.samples.join(" · ")}
          </td>
          <td
            data-cell="verdict"
            data-label="Donna"
            className={`whitespace-nowrap ${td} ${VERDICT[s.verdict][1]}`}
          >
            {VERDICT[s.verdict][0]}
            {s.unsubscribe ? (
              <span className="block text-slate-500">can unsubscribe</span>
            ) : null}
          </td>
          <td data-cell="action" className={td}>
            <select
              name={`sender-${i}`}
              data-group={group}
              defaultValue={startAction(s)}
              aria-label={`Action for ${s.sender}`}
              className={select}
            >
              <option value="spam">Spam</option>
              <option value="keep">Not spam: back to Inbox</option>
              <option value="leave">Decide later</option>
            </select>
          </td>
          <td data-cell="why" className={`${td} text-slate-400`}>
            <WhyCell why={s.why} />
          </td>
        </tr>
      ))
    ) : (
      <tr>
        <td colSpan={7} className={`${td} text-slate-500`}>
          None.
        </td>
      </tr>
    );

  const header = (
    label: string,
    list: Row[],
    group: string,
    hue: number,
    hint: string,
  ) => (
    <tr className={`border-t-2 border-t-slate-700 ${headTint(hue)}`}>
      <td
        data-cell="bucket"
        colSpan={5}
        className={`${td} text-sm font-semibold`}
      >
        {label} ({n(list.length, "sender")},{" "}
        {n(
          list.reduce((x, { s }) => x + s.count, 0),
          "email",
        )}
        )<span className="ml-2 text-xs font-normal text-slate-600">{hint}</span>
      </td>
      <td data-cell="action" colSpan={2} className={td}>
        <select
          aria-label={`Set all in ${label} to`}
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) setGroup(group, e.target.value);
            e.target.value = "";
          }}
          className={select}
        >
          <option value="">Set all to…</option>
          <option value="spam">Spam</option>
          <option value="keep">Not spam</option>
          <option value="leave">Decide later</option>
        </select>
      </td>
    </tr>
  );

  return (
    <form ref={form} action={action} onChange={recount} className="space-y-3">
      <input type="hidden" name="jobId" value={jobId} />
      <div className="donna-ui overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table
          aria-label="Review the spam"
          className="donna-cards w-full min-w-[820px] text-left text-xs"
        >
          <thead className="uppercase tracking-wide text-slate-500">
            <tr className="border-b border-slate-200">
              <th className={th}>Sender</th>
              <th className={th}>Emails</th>
              <th className={th}>Where</th>
              <th className={th}>Sample subjects</th>
              <th className={th}>Donna</th>
              <th className={th}>Action</th>
              <th className={`w-8 ${th}`}>
                <span className="sr-only">Why</span>
              </th>
            </tr>
          </thead>
          <tbody aria-label="Sure spam" className="divide-y divide-slate-100">
            {header(
              "Sure spam",
              sure,
              "sure",
              4,
              "Scan it; change any that are not spam.",
            )}
            {rows(sure, "sure", 4)}
          </tbody>
          <tbody aria-label="Check these" className="divide-y divide-slate-100">
            {header(
              "Check these",
              check,
              "check",
              1,
              "Donna is not sure, or it may be real.",
            )}
            {rows(check, "check", 1)}
          </tbody>
          <tbody aria-label="Trash">
            <tr
              className={`border-t-2 border-t-slate-700 ${headTint("slate")}`}
            >
              <td
                data-cell="bucket"
                colSpan={5}
                className={`${td} text-sm font-semibold`}
              >
                Trash ({n(plan.trash.total, "email")},{" "}
                {plan.trash.older30.toLocaleString("en-US")} older than 30 days)
              </td>
              <td data-cell="action" colSpan={2} className={td}>
                <select
                  name="trash"
                  defaultValue="leave"
                  aria-label="What to do with Trash"
                  className={select}
                >
                  <option value="leave">Leave Trash as it is</option>
                  <option value="older30">Empty: older than 30 days</option>
                  <option value="all">Empty all of Trash</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="sticky bottom-0 space-y-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm shadow-sm">
        <p className="text-slate-700">
          {doing
            ? [
                tally.spam
                  ? `Spam: ${n(tally.spam, "sender")} blocked in Zoho${tally.unsub ? `, unsubscribe from ${tally.unsub}` : ""}, ${n(tally.emails, "email")} to Trash`
                  : "",
                tally.keep
                  ? `Not spam: ${n(tally.keep, "sender")} back to Inbox and never blocked`
                  : "",
                tally.trashDelete
                  ? `Empty ${n(tally.trashDelete, "email")} from Trash`
                  : "",
              ]
                .filter(Boolean)
                .join(". ") + "."
            : "Nothing is set to change."}
          {tally.undecided
            ? ` ${n(tally.undecided, "sender")} left to decide later stay where they are.`
            : ""}
        </p>
        {tally.trashDelete ? (
          // Emptying Trash cannot be undone: it needs Tom's own tick, naming the count.
          <label className="donna-ui donna-tint donna-head donna-hue-4 flex items-start gap-2 rounded-lg px-2 py-1.5 text-rose-900">
            <input
              type="checkbox"
              name="approved"
              checked={approved}
              onChange={(e) => setApproved(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5"
            />
            <span>
              <span className="font-semibold">Approve:</span> permanently delete{" "}
              {n(tally.trashDelete, "email")} from Trash. This cannot be undone.
              Spam moved to Trash today stays there until a later job.
            </span>
          </label>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {blocked ? (
            <span className="text-xs text-amber-700">{blocked}</span>
          ) : (
            <button
              type="submit"
              disabled={!doing || (tally.spam + tally.keep === 0 && !approved)}
              className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-40"
            >
              Confirm
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

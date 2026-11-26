"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { CleanBarStatus } from "@/lib/donna/domain";
import { cancelClean, mailboxAction } from "@/app/(app)/donna/actions";

/**
 * One thin row on every page while Donna is cleaning Inbox: what it is on,
 * n of total, a progress track, and an ETA once it has started. Tap for
 * that clean's detail page; Pause/Resume and Stop sit on the right (Tom,
 * 2026-11-26). Hidden when no clean job is pending or leased.
 */
export function DonnaCleanBar() {
  const pathname = usePathname();
  const [job, setJob] = useState<CleanBarStatus | null>(null);
  const [mailboxId, setMailboxId] = useState<string | null>(null);
  const [nudge, setNudge] = useState(0);

  // Re-check on navigation so a clean started by a form redirect shows at once.
  useEffect(() => {
    let stopped = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      if (document.visibilityState === "visible") {
        try {
          const response = await fetch("/api/donna/clean", {
            cache: "no-store",
          });
          if (response.ok) {
            const body = (await response.json()) as {
              job?: CleanBarStatus | null;
              mailboxId?: string | null;
            };
            const next = body.job ?? null;
            running = Boolean(next);
            if (!stopped) {
              setJob(next);
              setMailboxId(body.mailboxId ?? null);
            }
          }
        } catch {
          // Offline for a moment: keep the last bar.
        }
      }
      if (!stopped) timer = setTimeout(poll, running ? 4_000 : 10_000);
    }
    function onStart(event: Event) {
      const detail = (event as CustomEvent<{ jobId?: string; total?: number }>)
        .detail;
      if (!detail?.jobId) return;
      const total = Math.max(0, Math.trunc(detail.total ?? 0));
      running = true;
      setJob({
        id: detail.jobId,
        title: "Cleaning inbox",
        paused: false,
        offline: false,
        waiting: true,
        total,
        done: 0,
        percent: 0,
        current: null,
        label: "Waiting for Donna",
        countLabel: `0 of ${total.toLocaleString("en-US")}`,
        etaLabel: null,
        recent: [],
      });
    }
    window.addEventListener("swapp:donna-clean", onStart);
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener("swapp:donna-clean", onStart);
    };
  }, [pathname, nudge]);

  if (!job) return null;
  const href = `/donna/cleans/${encodeURIComponent(job.id)}`;
  const aria = [
    job.title,
    job.label,
    job.countLabel,
    job.waiting ? null : `${job.percent}%`,
    job.etaLabel,
  ]
    .filter(Boolean)
    .join(". ");
  const control =
    "rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-100";
  return (
    <div className="flex shrink-0 items-start gap-2 border-b border-slate-200 bg-slate-50 px-4 py-1.5">
      <Link
        href={href}
        aria-current={pathname === href ? "page" : undefined}
        className="block min-w-0 flex-1 hover:opacity-80"
        aria-label={`${aria}. Open details.`}
      >
        <span className="flex items-center gap-2 text-xs">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${job.waiting ? "bg-amber-500" : "animate-pulse bg-slate-500"}`}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate text-slate-700">
            {job.title}
            <span className="text-slate-500"> · {job.label}</span>
            <span className="text-slate-400"> · {job.countLabel}</span>
            {job.etaLabel ? (
              <span className="text-slate-400"> · {job.etaLabel}</span>
            ) : null}
          </span>
          <span className="shrink-0 font-semibold tabular-nums text-slate-900">
            {job.percent}%
          </span>
        </span>
        <span
          className="mt-1 block h-1 overflow-hidden rounded-full bg-slate-200"
          aria-hidden="true"
        >
          <span
            className={`block h-1 rounded-full ${job.waiting ? "bg-amber-500" : "bg-slate-600"}`}
            style={{ width: `${job.percent}%` }}
          />
        </span>
        {job.recent.length ? (
          <ul aria-label="Just handled" className="mt-1 space-y-0.5">
            {job.recent.slice(0, 3).map((r, i) => (
              <li
                key={`${r.subject}-${i}`}
                className={`truncate text-xs ${i ? "text-slate-400" : "text-slate-700"}`}
              >
                <span className="font-medium">{r.subject}</span>
                <span> → {r.result}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Link>
      {mailboxId ? (
        <form
          action={async (data) => {
            await mailboxAction(data);
            setNudge((n) => n + 1);
          }}
        >
          <input type="hidden" name="mailboxId" value={mailboxId} />
          <input
            type="hidden"
            name="action"
            value={job.paused ? "resume" : "pause"}
          />
          <button type="submit" className={control}>
            {job.paused ? "Resume" : "Pause"}
          </button>
        </form>
      ) : null}
      <form
        action={async (data) => {
          await cancelClean(data);
          setJob(null);
          setNudge((n) => n + 1);
        }}
      >
        <input type="hidden" name="jobId" value={job.id} />
        <button type="submit" className={control}>
          Stop
        </button>
      </form>
    </div>
  );
}

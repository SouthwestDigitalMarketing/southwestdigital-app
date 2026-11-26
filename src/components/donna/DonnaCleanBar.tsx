"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { CleanBarStatus } from "@/lib/donna/domain";

/**
 * One thin row on every page while Donna is cleaning Inbox: what it is on,
 * n of total, a progress track, and an ETA once it has started. Tap for
 * that clean's detail page. Hidden when no clean job is pending or leased.
 */
export function DonnaCleanBar() {
  const pathname = usePathname();
  const [job, setJob] = useState<CleanBarStatus | null>(null);

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
            };
            const next = body.job ?? null;
            running = Boolean(next);
            if (!stopped) setJob(next);
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
        title: "Checking inbox",
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
      });
    }
    window.addEventListener("swapp:donna-clean", onStart);
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener("swapp:donna-clean", onStart);
    };
  }, [pathname]);

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
  return (
    <Link
      href={href}
      aria-current={pathname === href ? "page" : undefined}
      className="block shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-1.5 hover:bg-slate-100"
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
    </Link>
  );
}

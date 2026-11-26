"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type CleanJob = { id: string; status: string };

/**
 * One thin row on every page while Donna is cleaning Inbox. Tap for that
 * clean's detail page. Hidden when no clean job is pending or leased.
 */
export function DonnaCleanBar() {
  const pathname = usePathname();
  const [job, setJob] = useState<CleanJob | null>(null);

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
            const body = (await response.json()) as { job?: CleanJob | null };
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
      const id = (event as CustomEvent<{ jobId?: string }>).detail?.jobId;
      if (!id) return;
      running = true;
      setJob({ id, status: "pending" });
    }
    window.addEventListener("swapp:donna-clean", onStart);
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener("swapp:donna-clean", onStart);
    };
  }, []);

  if (!job) return null;
  const href = `/donna/cleans/${encodeURIComponent(job.id)}`;
  return (
    <Link
      href={href}
      aria-current={pathname === href ? "page" : undefined}
      className="block shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-1.5 hover:bg-slate-100"
      aria-label="Cleaning inbox. Open inbox clean details."
    >
      <span className="flex items-center gap-2 text-xs text-slate-600">
        <span
          className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-slate-400"
          aria-hidden="true"
        />
        <span className="min-w-0 truncate">Cleaning inbox</span>
      </span>
    </Link>
  );
}

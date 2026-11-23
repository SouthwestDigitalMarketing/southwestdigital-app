"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, X } from "lucide-react";
import { getScanStatus, type ScanStatus } from "@/app/(app)/scanActions";
import type { ScanSourceState } from "@/lib/scan/sources";

/** Modal order: anything needing Tom first, then in-flight, waiting, done. */
function sortRows(rows: ScanSourceState[]): ScanSourceState[] {
  const rank = (status: ScanSourceState["status"]) =>
    status === "needs-you" ? 0 : status === "scanning" ? 1 : status === "waiting" ? 2 : 3;
  return [...rows].sort((a, b) => rank(a.status) - rank(b.status));
}

function Pill({ status }: { status: ScanSourceState["status"] }) {
  if (status === "needs-you")
    return <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Needs you</span>;
  if (status === "scanning")
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800">
        <Loader2 size={12} className="animate-spin" /> Scanning
      </span>
    );
  if (status === "done")
    return <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">Done</span>;
  return <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">Waiting</span>;
}

/** Scan progress modal (Tom 2026-11-23): every source with live progress.
 * Login items pin at the top with a Log in button; everything else scans in
 * parallel and nothing waits on Tom. Closing never stops the scan. */
export function ScanModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [status, setStatus] = useState<ScanStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getScanStatus());
    } catch {
      // The modal keeps its last view when the tables are not migrated yet.
    }
  }, []);

  const first = useRef(true);
  useEffect(() => {
    if (!open) {
      first.current = true;
      return;
    }
    if (first.current) {
      first.current = false;
      refresh();
    }
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const rows = sortRows(status?.sources ?? []);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan progress"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">Scan{status?.running ? " — running" : ""}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scan progress"
            className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li key={row.source} className="rounded-xl border border-slate-200 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-medium text-slate-800">{row.label}</p>
                <Pill status={row.status} />
              </div>
              {row.detail ? <p className="mt-1 text-xs text-slate-500">{row.detail}</p> : null}
              {row.status === "needs-you" && row.loginUrl ? (
                <a
                  href={row.loginUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                >
                  {row.loginLabel ?? "Log in"} <ExternalLink size={12} />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          {status?.running
            ? "Closing this keeps the scan running — the header icon spins until it lands."
            : `Finished ${status?.updatedAgo.toLowerCase() ?? ""}. Press Scan for a fresh pass.`}
        </p>
      </div>
    </div>
  );
}

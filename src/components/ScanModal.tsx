"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { getScanStatus, type ScanStatus } from "@/app/(app)/scanActions";
import type { ScanSourceState } from "@/lib/scan/sources";

/** Full-screen scan sheet (Tom 2026-11-23): title then the numbered checklist,
 * top-aligned on phone and desktop. Long lines wrap so the Log in link is
 * never cut off. Closing never stops the scan. */
export function ScanModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [status, setStatus] = useState<ScanStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getScanStatus());
    } catch {
      // The sheet keeps its last view when the tables are not migrated yet.
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getScanStatus()
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch(() => {});
    const timer = setInterval(refresh, 4000);
    // A backgrounded phone browser throttles intervals: refresh on return.
    const wake = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
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
  const rows = foldQuickBooks(status?.sources ?? []);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan progress"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col rounded-2xl bg-white p-4 shadow-xl sm:p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3">
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
        {rows.length > 0 ? (
          <ol className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto text-sm">
            {rows.map((row, index) => (
              <li key={row.source} className="flex min-w-0 items-baseline gap-2">
                <span className="shrink-0 tabular-nums text-slate-400">{index + 1}.</span>
                <Glyph status={row.status} />
                <span className="min-w-0 flex-1 break-words text-slate-800">
                  {row.label}
                  {row.detail ? <span className="text-slate-500"> — {row.detail}</span> : null}
                  {row.status === "needs-you" && row.loginUrl ? (
                    <a
                      href={row.loginUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1.5 whitespace-nowrap font-medium text-amber-700 underline decoration-amber-300 underline-offset-2 hover:text-amber-900"
                    >
                      {row.loginLabel ?? "Log in"} ↗
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-sm text-slate-500">{status?.running ? "Starting…" : "No source detail yet."}</p>
        )}
        <p className="mt-3 shrink-0 text-xs text-slate-500">
          {status?.running
            ? "Closing this keeps the scan running."
            : `Finished ${status?.updatedAgo.toLowerCase() ?? ""}. Press Scan for a fresh pass.`}
        </p>
      </div>
    </div>
  );
}

function Glyph({ status }: { status: ScanSourceState["status"] }) {
  if (status === "done") return <span className="shrink-0 font-bold text-emerald-600">✓</span>;
  if (status === "needs-you") return <span className="shrink-0 font-bold text-amber-600">!</span>;
  if (status === "scanning")
    return <Loader2 size={13} className="shrink-0 translate-y-0.5 animate-spin text-sky-600" />;
  return <span className="shrink-0 text-slate-300">○</span>;
}

/** Modal order: anything needing Tom first, then in-flight, waiting, done.
 * Legacy runs stored two QBO rows (access + Contracts); they share one
 * sign-in, so they fold into a single QuickBooks line. */
function foldQuickBooks(rows: ScanSourceState[]): ScanSourceState[] {
  const rank = (status: ScanSourceState["status"]) =>
    status === "needs-you" ? 0 : status === "scanning" ? 1 : status === "waiting" ? 2 : 3;
  const legacy = rows.filter((row) => row.source.startsWith("qbo-"));
  const rest = rows.filter((row) => !row.source.startsWith("qbo-"));
  if (legacy.length > 0 && !rest.some((row) => row.source === "quickbooks")) {
    const worst = [...legacy].sort((a, b) => rank(a.status) - rank(b.status))[0];
    const details = [...new Set(legacy.map((row) => row.detail).filter(Boolean))];
    rest.unshift({
      source: "quickbooks",
      label: "QuickBooks",
      status: worst.status,
      detail: details.length > 0 ? details.join("; ") : worst.detail,
      loginUrl: legacy.find((row) => row.loginUrl)?.loginUrl ?? null,
      loginLabel: "Log in",
    });
  }
  return [...rest].sort((a, b) => rank(a.status) - rank(b.status));
}

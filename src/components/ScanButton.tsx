"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { getScanStatus, requestScan, type ScanStatus } from "@/app/(app)/scanActions";
import { ScanModal } from "@/components/ScanModal";

/** Header Scan button (sop-money-playbook): one press refreshes everything
 * that can be refreshed. Shows minutes since the last completed scan. */
export function ScanButton({ compact = false, children }: { compact?: boolean; children?: ReactNode }) {
  const [status, setStatus] = useState<ScanStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const setModal = useCallback((next: boolean) => {
    setModalOpen(next);
    try {
      const url = new URL(window.location.href);
      if (next) {
        if (url.hash !== "#scan") {
          url.hash = "#scan";
          window.history.replaceState(null, "", url.toString());
        }
      } else if (url.hash === "#scan") {
        url.hash = "";
        window.history.replaceState(null, "", url.toString());
      }
    } catch {
      // No history API (unusual embed): the sheet still opens; it just will not survive a reload.
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getScanStatus());
    } catch {
      // The header stays quiet when the scan tables are not migrated yet.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const onHash = () => {
      try {
        if (new URL(window.location.href).hash !== "#scan") setModalOpen(false);
      } catch {
        // Ignore.
      }
    };
    window.addEventListener("hashchange", onHash);
    getScanStatus()
      .then((next) => {
        if (cancelled) return;
        setStatus(next);
        // A reloaded page with #scan reopens the sheet where Tom left it.
        try {
          if (new URL(window.location.href).hash === "#scan") setModalOpen(true);
        } catch {
          // No URL API; start closed.
        }
      })
      .catch(() => {});
    timer.current = setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      window.removeEventListener("hashchange", onHash);
      if (timer.current) clearInterval(timer.current);
    };
  }, [refresh, setModal]);

  // Tapping always opens the sheet — even mid-scan, when that is exactly
  // what Tom wants to watch. A fresh scan is only requested when idle.
  const scan = useCallback(async () => {
    setModal(true);
    if (busy || status?.running) {
      refresh();
      return;
    }
    setBusy(true);
    try {
      await requestScan();
    } catch {
      // A failed press just leaves the last status in place; the sheet shows it.
    } finally {
      setBusy(false);
      refresh();
    }
  }, [busy, status, refresh, setModal]);

  const running = busy || status?.running === true;
  return (
    <>
      <ScanModal open={modalOpen} onClose={() => setModal(false)} />
      <div className={compact ? "flex items-center" : "flex w-full items-center gap-2"}>
        <button
          type="button"
          onClick={scan}
          disabled={busy}
          aria-label={status ? `Scan for updates. ${status.updatedAgo}` : "Scan for updates"}
          title={running ? "Scanning — tap to watch" : "Scan for updates"}
          className={
            compact
              ? "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              : "inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          }
        >
          <RefreshCw size={compact ? 20 : 15} className={running ? "animate-spin" : undefined} />
          {compact ? null : "Scan"}
          {!compact && status?.minutesSinceUpdate != null && (
            <span
              className={`text-xs tabular-nums ${
                status.minutesSinceUpdate < 30 ? "opacity-70" : status.minutesSinceUpdate > 60 ? "text-red-600" : ""
              }`}
            >
              {status.minutesSinceUpdate}
            </span>
          )}
        </button>
        {children}
      </div>
    </>
  );
}

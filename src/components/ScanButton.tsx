"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { getScanStatus, requestScan, type ScanStatus } from "@/app/(app)/scanActions";

/** Header Scan button (sop-money-playbook): one press refreshes everything
 * that can be refreshed. Shows when the last scan landed and what changed. */
export function ScanButton({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<ScanStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getScanStatus());
    } catch {
      // The header stays quiet when the scan tables are not migrated yet.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getScanStatus()
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch(() => {});
    timer.current = setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
    };
  }, [refresh]);

  const scan = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await requestScan();
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10_000));
        const next = await getScanStatus();
        setStatus(next);
        if (!next.running) break;
      }
    } catch {
      // A failed press just leaves the last status in place.
    } finally {
      setBusy(false);
      refresh();
    }
  }, [busy, refresh]);

  const running = busy || status?.running === true;
  return (
    <div className={compact ? "flex items-center gap-2" : "w-full"}>
      <button
        type="button"
        onClick={scan}
        disabled={running}
        aria-label="Scan for updates"
        title={running ? "Scanning…" : "Scan for updates"}
        className={
          compact
            ? "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            : "inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        }
      >
        <RefreshCw size={compact ? 20 : 15} className={running ? "animate-spin" : undefined} />
        {compact ? null : running ? "Scanning…" : "Scan"}
      </button>
      {compact ? null : (
        <p className="mt-1 text-center text-xs text-slate-500">{status?.updatedAgo ?? "Never scanned"}</p>
      )}
      {!compact && status && !status.running && status.changes.length > 0 ? (
        <details className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <summary className="cursor-pointer font-medium">What changed</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {status.changes.map((change, index) => (
              <li key={`${change.kind}-${index}`}>{change.text}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

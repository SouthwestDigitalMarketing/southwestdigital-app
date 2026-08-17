"use client";

import { useEffect, useState, useCallback } from "react";

type RealtimeData = {
  activeUsers: number;
  byPage: { page: string; activeUsers: number }[];
  asOf: string;
};

export function RealtimeWidget({ propertyId }: { propertyId: string }) {
  const [data, setData] = useState<RealtimeData | null>(null);
  const [error, setError] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/analytics/realtime?propertyId=${propertyId}`);
      if (!res.ok) throw new Error();
      const json: RealtimeData = await res.json();
      setData(json);
      setLastRefresh(new Date());
      setError(false);
    } catch {
      setError(true);
    }
  }, [propertyId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Real-time — last 30 min
          </p>
        </div>
        {lastRefresh && (
          <p className="text-xs text-slate-400">
            Updated {lastRefresh.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </p>
        )}
      </div>

      {error ? (
        <p className="mt-3 text-sm text-amber-700">Unable to load real-time data.</p>
      ) : data === null ? (
        <p className="mt-3 text-sm text-slate-400">Loading...</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-8">
          <div>
            <p className="text-5xl font-semibold tabular-nums text-slate-900">
              {data.activeUsers}
            </p>
            <p className="mt-1 text-xs text-slate-500">active users right now</p>
          </div>

          {data.byPage.length > 0 && (
            <div className="flex-1 min-w-48">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Active pages
              </p>
              <div className="space-y-1">
                {data.byPage.map((p) => (
                  <div key={p.page} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate text-slate-600">{p.page}</span>
                    <span className="shrink-0 tabular-nums text-slate-900 font-medium">
                      {p.activeUsers}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

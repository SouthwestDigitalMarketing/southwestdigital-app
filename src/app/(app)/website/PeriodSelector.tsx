"use client";

import { useRouter, useSearchParams } from "next/navigation";

const PERIODS = [
  { label: "Live", value: "live" },
  { label: "Yesterday", value: "yday" },
  { label: "48 hours", value: "48h" },
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
] as const;

export function PeriodSelector({ current }: { current: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function select(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", value);
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
      {PERIODS.map(({ label, value }) => {
        const isActive = current === value;
        const isLive = value === "live";
        return (
          <button
            key={value}
            onClick={() => select(value)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? isLive
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {isLive && (
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                {isActive && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                )}
                <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${isActive ? "bg-white" : "bg-emerald-500"}`} />
              </span>
            )}
            {label}
          </button>
        );
      })}
    </div>
  );
}

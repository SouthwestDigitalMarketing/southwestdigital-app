"use client";

import { useRouter, useSearchParams } from "next/navigation";

const PERIODS = [
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
      {PERIODS.map(({ label, value }) => (
        <button
          key={value}
          onClick={() => select(value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            current === value
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type RangeOption = {
  value: string;
  label: string;
};

export function DashboardControls({
  options,
  selectedRange,
}: {
  options: RangeOption[];
  selectedRange: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function update(range: string) {
    const params = new URLSearchParams();
    if (range !== "last-30-days") params.set("range", range);
    // Keep the response-time range the Scorecard section is showing.
    const rt = searchParams.get("rt");
    if (rt) params.set("rt", rt);
    const query = params.toString();
    startTransition(() => router.push(`/dashboard${query ? `?${query}` : ""}`, { scroll: false }));
  }

  return (
    <div>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
        Reporting period
        <select
          value={selectedRange}
          onChange={(event) => update(event.target.value)}
          disabled={isPending}
          className="ui-focus-ring min-w-48 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-slate-400 disabled:cursor-wait disabled:opacity-60 sm:py-2"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

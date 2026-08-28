"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

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
  const [isPending, startTransition] = useTransition();

  function update(range: string) {
    const params = new URLSearchParams();
    if (range !== "last-30-days") params.set("range", range);
    const query = params.toString();
    startTransition(() => router.push(`/dashboard${query ? `?${query}` : ""}`));
  }

  return (
    <div>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
        Reporting period
        <select
          value={selectedRange}
          onChange={(event) => update(event.target.value)}
          disabled={isPending}
          className="min-w-48 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-slate-400 disabled:cursor-wait disabled:opacity-60"
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

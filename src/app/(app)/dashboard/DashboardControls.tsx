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
  comparePrevious,
}: {
  options: RangeOption[];
  selectedRange: string;
  comparePrevious: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function update(range: string, compare: boolean) {
    const params = new URLSearchParams();
    if (range !== "last-30-days") params.set("range", range);
    if (compare) params.set("compare", "previous");
    const query = params.toString();
    startTransition(() => router.push(`/dashboard${query ? `?${query}` : ""}`));
  }

  return (
    <div className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-3">
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
        Reporting period
        <select
          value={selectedRange}
          onChange={(event) => update(event.target.value, comparePrevious)}
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

      <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={comparePrevious}
          onChange={(event) => update(selectedRange, event.target.checked)}
          disabled={isPending}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="relative h-5 w-9 rounded-full bg-slate-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-slate-900 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-slate-500 peer-focus-visible:ring-offset-2 peer-disabled:cursor-wait peer-disabled:opacity-60"
        />
        Compare to previous period
      </label>
    </div>
  );
}

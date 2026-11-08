"use client";

import { useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { goalColors } from "../website/goal-colors";

type OfferStats = {
  awaiting: number;
  sent: number;
  accepted: number;
  rejected: number;
};

function change(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function Comparison({ value }: { value: number | null }) {
  if (value === 0) return null;
  return (
    <span className={`text-xs font-semibold tabular-nums ${value === null ? "text-slate-500" : value < 0 ? "text-rose-700" : "text-emerald-700"}`}>
      {value === null ? "New" : `${value > 0 ? "+" : ""}${value}%`}
    </span>
  );
}

function OfferMetric({
  label,
  value,
  previous,
  goal,
}: {
  label: string;
  value: number;
  previous: number;
  goal?: number;
}) {
  const comparison = change(value, previous);
  const pct = goal ? Math.max(0, Math.min(100, Math.round((value / goal) * 100))) : 0;
  const color = goal ? goalColors(pct).bar : undefined;

  return (
    <li className="py-3 first:pt-2 last:pb-1">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <FileText size={14} className="shrink-0 text-slate-400" />
          <span className="truncate text-sm font-medium text-slate-700">{label}</span>
          <Comparison value={comparison} />
        </span>
        <span className="flex shrink-0 items-baseline gap-2">
          <span className="text-xl font-semibold tabular-nums text-slate-900">{value}</span>
          {goal ? <span className="text-xs tabular-nums text-slate-500">/ {goal} goal</span> : null}
        </span>
      </div>
      {goal ? (
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-label={`${label} goal progress`}
          aria-valuemin={0}
          aria-valuemax={goal}
          aria-valuenow={Math.min(value, goal)}
        >
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      ) : null}
    </li>
  );
}

export function OffersStatCard({
  current,
  previous,
  sentGoal,
  acceptedGoal,
}: {
  current: OfferStats;
  previous: OfferStats;
  sentGoal: number;
  acceptedGoal: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-6">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Hide offer details" : "Show offer details"}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
            <FileText size={14} className="shrink-0 text-slate-400" />
            Offers sent this period
          </span>
          <span className="mt-1 block text-2xl font-semibold tabular-nums text-slate-900 sm:mt-2 sm:text-3xl">
            {current.sent}
          </span>
          <span className="mt-0.5 block text-xs text-slate-500">
            {current.awaiting} awaiting reply
          </span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100 pt-1">
          <OfferMetric label="Awaiting reply" value={current.awaiting} previous={previous.awaiting} />
          <OfferMetric label="Sent" value={current.sent} previous={previous.sent} goal={sentGoal} />
          <OfferMetric label="Accepted" value={current.accepted} previous={previous.accepted} goal={acceptedGoal} />
          <OfferMetric label="Rejected" value={current.rejected} previous={previous.rejected} />
        </ul>
      ) : null}
    </div>
  );
}

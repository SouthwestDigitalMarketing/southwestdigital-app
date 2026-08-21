import type { ReactNode } from "react";
import Link from "next/link";
import { ExternalLink, ArrowRight } from "lucide-react";

function goalColor(pct: number): string {
  return pct >= 100 ? "#6b8e23" : pct >= 60 ? "#f59e0b" : "#cc0000";
}

type GoalDisplay = {
  pct: number;
  subtitle: string;
};

type Attribution = {
  label: string;
  href: string;
};

export function StatCard({
  label,
  value,
  goal,
  icon,
  attribution,
  detailsHref,
}: {
  label: string;
  value: string;
  goal?: GoalDisplay;
  icon?: ReactNode;
  attribution?: Attribution;
  detailsHref?: string;
}) {
  const color = goal ? goalColor(goal.pct) : undefined;

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-slate-400">
            {icon}
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          </div>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">{value}</p>
          {goal && <p className="mt-0.5 text-xs text-slate-500">{goal.subtitle}</p>}
        </div>
        {goal && (
          <div className="shrink-0 text-right">
            <span className="text-2xl font-bold tabular-nums" style={{ color }}>
              {goal.pct}%
            </span>
            <p className="text-xs text-slate-400">of goal</p>
          </div>
        )}
      </div>

      {goal && (
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${goal.pct}%`, background: color }}
          />
        </div>
      )}

      {(attribution || detailsHref) && (
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          {attribution ? (
            <a
              href={attribution.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-slate-600"
            >
              {attribution.label}
              <ExternalLink size={10} />
            </a>
          ) : (
            <span />
          )}
          {detailsHref && (
            <Link
              href={detailsHref}
              className="flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900"
            >
              See details
              <ArrowRight size={10} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

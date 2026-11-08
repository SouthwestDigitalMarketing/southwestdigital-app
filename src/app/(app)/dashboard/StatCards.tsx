import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { goalColors } from "../website/goal-colors";

type GoalDisplay = {
  pct: number;
  subtitle: string;
};

type Attribution = {
  label: string;
  href: string;
};

function comparisonColor(value: number | null): string {
  if (value === null || value === 0) return "text-slate-500";
  return value > 0 ? "text-emerald-700" : "text-rose-700";
}

export function StatCard({
  label,
  value,
  goal,
  goalColor,
  comparison,
  icon,
  attribution,
  className,
}: {
  label: string;
  value: string;
  goal?: GoalDisplay;
  goalColor?: string;
  comparison?: number | null;
  icon?: ReactNode;
  attribution?: Attribution;
  className?: string;
}) {
  const pct = goal ? Math.max(0, Math.min(100, Number.isFinite(goal.pct) ? goal.pct : 0)) : 0;
  const color = goal ? (goalColor ?? goalColors(pct).bar) : undefined;

  return (
    <div className={`relative flex flex-col rounded-xl border border-slate-200 bg-white p-3 sm:p-6 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-2 sm:items-start sm:gap-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-start gap-1.5 text-slate-400">
            <span className="mt-0.5 shrink-0">{icon}</span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">{label}</p>
              {attribution && (
                <a
                  href={attribution.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 hidden w-fit max-w-full items-center gap-1 truncate text-xs font-medium normal-case tracking-normal text-slate-400 transition-colors hover:text-slate-600 sm:flex"
                >
                  <span className="truncate">{attribution.label}</span>
                  <ExternalLink size={10} className="shrink-0" />
                </a>
              )}
            </div>
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 sm:mt-2">
            <p
              className="text-2xl font-semibold tabular-nums sm:text-3xl"
              style={{ color: "var(--text-primary)" }}
            >
              {value}
            </p>
            {comparison !== undefined && comparison !== 0 && (
              <span className={`text-sm font-semibold tabular-nums ${comparisonColor(comparison)}`}>
                {comparison === null ? "New" : `${comparison > 0 ? "+" : ""}${comparison}%`}
              </span>
            )}
          </div>
          {goal && <p className="mt-0.5 hidden text-xs text-slate-500 sm:block">{goal.subtitle}</p>}
        </div>
        {goal && (
          <div className="shrink-0 text-right">
            <span
              className="text-lg font-bold tabular-nums sm:text-2xl"
              style={{ color: "var(--text-primary)" }}
            >
              {pct}%
            </span>
            <p className="hidden text-xs text-slate-400 sm:block">of goal</p>
          </div>
        )}
      </div>

      {goal && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 sm:mt-4 sm:h-2">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
      )}
    </div>
  );
}

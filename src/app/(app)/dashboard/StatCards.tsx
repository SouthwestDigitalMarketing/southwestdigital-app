import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";

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
  goalColor = "#17324d",
  comparison,
  icon,
  attribution,
}: {
  label: string;
  value: string;
  goal?: GoalDisplay;
  goalColor?: string;
  comparison?: number | null;
  icon?: ReactNode;
  attribution?: Attribution;
}) {
  const color = goal ? goalColor : undefined;

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-start gap-1.5 text-slate-400">
            <span className="mt-0.5 shrink-0">{icon}</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
              {attribution && (
                <a
                  href={attribution.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex w-fit max-w-full items-center gap-1 truncate text-xs font-medium normal-case tracking-normal text-slate-400 transition-colors hover:text-slate-600"
                >
                  <span className="truncate">{attribution.label}</span>
                  <ExternalLink size={10} className="shrink-0" />
                </a>
              )}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p
              className="text-3xl font-semibold tabular-nums"
              style={{ color: "var(--text-primary)" }}
            >
              {value}
            </p>
            {comparison !== undefined && (
              <span className={`text-sm font-semibold tabular-nums ${comparisonColor(comparison)}`}>
                {comparison === null ? "New" : `${comparison > 0 ? "+" : ""}${comparison}%`}
              </span>
            )}
          </div>
          {goal && <p className="mt-0.5 text-xs text-slate-500">{goal.subtitle}</p>}
        </div>
        {goal && (
          <div className="shrink-0 text-right">
            <span
              className="text-2xl font-bold tabular-nums"
              style={{ color: "var(--text-primary)" }}
            >
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
    </div>
  );
}

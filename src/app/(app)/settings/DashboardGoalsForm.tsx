"use client";

import { useState, useTransition } from "react";
import { updateDashboardGoal, type DashboardGoalField } from "../dashboard/actions";

const GOAL_FIELDS: { field: DashboardGoalField; label: string; hint: string; max?: number }[] = [
  { field: "monthlyOffersSentGoal", label: "Offers sent", hint: "Offers to send each month" },
  { field: "monthlyOffersAcceptedGoal", label: "Offers accepted", hint: "Offers to win each month" },
  { field: "monthlyReviewRequestsGoal", label: "Review requests", hint: "Requests to send each month" },
  { field: "reviewOpenRateGoal", label: "Review open rate", hint: "Percent of requests opened", max: 100 },
  { field: "reviewFiveStarRateGoal", label: "Google-clicked rate", hint: "Percent that reach Google", max: 100 },
];

export function DashboardGoalsForm({
  brandId,
  goals,
}: {
  brandId: string;
  goals: Record<DashboardGoalField, number>;
}) {
  const [pending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<DashboardGoalField, string>>(() =>
    Object.fromEntries(GOAL_FIELDS.map(({ field }) => [field, String(goals[field])])) as Record<
      DashboardGoalField,
      string
    >,
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function save() {
    setError(null);
    setSaved(false);
    const parsed = new Map<DashboardGoalField, number>();
    for (const { field, max } of GOAL_FIELDS) {
      const value = Math.round(Number(drafts[field]));
      if (!Number.isFinite(value) || value <= 0) {
        setError("Goals must be whole numbers greater than zero.");
        return;
      }
      const next = max ? Math.min(max, value) : value;
      if (next !== goals[field]) parsed.set(field, next);
    }
    if (parsed.size === 0) {
      setSaved(true);
      return;
    }
    startTransition(async () => {
      try {
        await Promise.all(
          [...parsed].map(([field, value]) => updateDashboardGoal(brandId, field, value)),
        );
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save goals.");
      }
    });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dashboard goals</h2>
      <p className="mt-1 text-sm text-slate-500">Monthly targets behind the dashboard progress bars.</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {GOAL_FIELDS.map(({ field, label, hint, max }) => (
          <label key={field} className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            {label}
            <span className="text-xs font-normal text-slate-400">{hint}</span>
            <input
              type="number"
              min={1}
              max={max}
              value={drafts[field]}
              disabled={pending}
              onChange={(event) => {
                setSaved(false);
                setDrafts((current) => ({ ...current, [field]: event.target.value }));
              }}
              className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-base tabular-nums text-slate-900 focus:border-slate-500 focus:outline-none disabled:opacity-60"
            />
          </label>
        ))}
      </div>
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      {saved ? <p className="mt-3 text-sm text-emerald-700">Goals saved.</p> : null}
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="ui-action-primary mt-4 rounded-md px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save goals"}
      </button>
    </section>
  );
}

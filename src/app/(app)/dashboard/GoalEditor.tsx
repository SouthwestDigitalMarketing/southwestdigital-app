"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { updateDashboardGoal, type DashboardGoalField } from "./actions";

export function GoalEditor({
  brandId,
  field,
  goal,
}: {
  brandId: string;
  field: DashboardGoalField;
  goal: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(goal));
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function save() {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    startTransition(async () => {
      await updateDashboardGoal(brandId, field, parsed);
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <div className="absolute right-4 top-4 z-10 flex items-center gap-1">
        <input
          ref={inputRef}
          type="number"
          min={1}
          max={field.endsWith("RateGoal") ? 100 : undefined}
          value={draft}
          disabled={pending}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") save();
            if (event.key === "Escape") setEditing(false);
          }}
          className="w-16 rounded-md border border-slate-300 px-1.5 py-1 text-right text-xs tabular-nums"
        />
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="ui-action-primary rounded-md px-2 py-1 text-xs font-semibold transition disabled:opacity-50"
        >
          Save
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(String(goal));
        setEditing(true);
      }}
      className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-600"
      aria-label="Edit goal"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
        <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.699 1.196l-.51 1.843a.5.5 0 0 0 .611.61l1.84-.508a2.75 2.75 0 0 0 1.196-.7l4.261-4.262a1.75 1.75 0 0 0 0-2.474Z" />
      </svg>
    </button>
  );
}

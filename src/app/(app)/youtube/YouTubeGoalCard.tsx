"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { updateYouTubeGoal } from "./actions";

type Field = "monthlyViewsGoal" | "youtubeWatchPercentageGoal";

function goalColors(pct: number) {
  if (pct >= 100) return { bar: "#10b981", text: "text-emerald-600" };
  if (pct >= 70) return { bar: "#f59e0b", text: "text-amber-600" };
  return { bar: "#f43f5e", text: "text-rose-600" };
}

export function YouTubeGoalCard({
  brandId,
  label,
  value,
  goal,
  goalLabel,
  pct,
  field,
  description,
}: {
  brandId: string;
  label: string;
  value: string;
  goal: number;
  goalLabel: string;
  pct: number;
  field: Field;
  description?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(goal));
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // Keep draft in sync if parent re-renders with new goal after save
  useEffect(() => {
    if (!editing) setDraft(String(goal));
  }, [goal, editing]);

  const capped = Math.min(100, pct);
  const met = pct >= 100;
  const { bar, text } = goalColors(pct);

  function handleSave() {
    const parsed = Number(draft);
    if (!isFinite(parsed) || parsed <= 0) return;
    startTransition(async () => {
      await updateYouTubeGoal(brandId, field, parsed);
      setEditing(false);
    });
  }

  function handleCancel() {
    setDraft(String(goal));
    setEditing(false);
  }

  return (
    <div className="relative rounded-xl border border-slate-200 bg-white p-6">
      {!editing && (
        <button
          onClick={() => setEditing(true)}
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-600"
          aria-label="Edit goal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.699 1.196l-.51 1.843a.5.5 0 0 0 .611.61l1.84-.508a2.75 2.75 0 0 0 1.196-.7l4.261-4.262a1.75 1.75 0 0 0 0-2.474Z" />
          </svg>
        </button>
      )}

      <div className="flex items-center gap-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {description && (
          <span className="group/tip relative flex">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 cursor-default text-slate-300 hover:text-slate-400">
              <path fillRule="evenodd" d="M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0ZM9 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM6.75 8a.75.75 0 0 0 0 1.5h.75v1.75a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8.25 8h-1.5Z" clipRule="evenodd" />
            </svg>
            <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-60 -translate-x-1/2 rounded-lg bg-slate-800 px-3 py-2 text-xs font-normal normal-case leading-relaxed tracking-normal text-white opacity-0 shadow-lg transition-opacity group-hover/tip:opacity-100">
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-800" />
              {description}
            </span>
          </span>
        )}
      </div>

      <div className="mt-3 flex items-end justify-between gap-4">
        <p className="text-4xl font-semibold tabular-nums text-slate-900">{value}</p>
        <p className={`mb-1 text-xl font-bold tabular-nums ${text}`}>{Math.round(pct)}%</p>
      </div>

      {editing ? (
        <div className="mt-2 flex items-center gap-2">
          <input
            ref={inputRef}
            type="number"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
            className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm tabular-nums text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleSave}
            disabled={isPending}
            className="rounded p-1 text-emerald-600 transition-colors hover:text-emerald-700 disabled:opacity-40"
            aria-label="Save"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            onClick={handleCancel}
            disabled={isPending}
            className="rounded p-1 text-slate-400 transition-colors hover:text-slate-600 disabled:opacity-40"
            aria-label="Cancel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
              <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
            </svg>
          </button>
        </div>
      ) : (
        <p className="mt-1 text-sm text-slate-400">{goalLabel}</p>
      )}

      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${capped}%`, backgroundColor: bar }}
        />
      </div>
      {met && <p className={`mt-2 text-xs font-semibold ${text}`}>Goal met!</p>}
    </div>
  );
}

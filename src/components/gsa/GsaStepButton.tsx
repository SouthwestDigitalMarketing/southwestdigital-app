"use client";

import { useState, useTransition } from "react";
import { setGsaStepAction } from "@/app/(app)/gsa/actions";
import type { GsaStep } from "@/lib/gsa/progress";

/** "Mark done" for a GSA step not reached yet, "Undo" for one already done. */
export function GsaStepButton({ engagementId, step, done, label }: {
  engagementId: string;
  step: GsaStep;
  done: boolean;
  label: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await setGsaStepAction(engagementId, step, !done);
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Could not save.");
            }
          });
        }}
        aria-label={done ? `Undo ${label}` : `Mark ${label} done`}
        className={done
          ? "min-h-9 rounded-lg px-2 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          : "ui-action-secondary min-h-9 rounded-lg border px-3 text-xs font-semibold transition disabled:opacity-50"}
      >
        {isPending ? "Saving…" : done ? "Undo" : "Mark done"}
      </button>
      {error ? <span className="block text-xs text-rose-700">{error}</span> : null}
    </>
  );
}

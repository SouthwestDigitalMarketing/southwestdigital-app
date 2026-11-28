"use client";

import { useState, useTransition } from "react";
import { addSetListPeopleAction, type AddPeopleResult } from "./actions";

export function AddPeopleButton({ count }: { count: number }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AddPeopleResult | null>(null);
  return (
    <div className="mt-4 max-w-2xl rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-700">
        Add the {count} researched planners, DJs, venues and bands to Contacts, tagged Music. Anyone already there just gets the tags.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setResult(await addSetListPeopleAction()))}
        className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add to Contacts"}
      </button>
      {result ? (
        <p className={`mt-2 text-sm ${result.error ? "text-red-700" : "text-slate-600"}`} role="status">
          {result.error ?? `Added ${result.created}; tagged ${result.tagged} already in Contacts.`}
        </p>
      ) : null}
    </div>
  );
}

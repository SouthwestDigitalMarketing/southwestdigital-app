"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AD_AREAS, CALL_TO_ACTIONS, DEFAULT_DRAFT } from "@/lib/ads/draft";
import { createAdDraft, type CreateAdState } from "../actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 outline-none focus:border-brandnavy focus:ring-2 focus:ring-brandnavy/20";
const labelClass = "block text-base font-semibold text-slate-700";
const hintClass = "mt-1 block text-sm font-normal text-slate-500";

const initialState: CreateAdState = { error: null };

export function CreateAdForm() {
  const [state, formAction, pending] = useActionState(createAdDraft, initialState);

  return (
    <form action={formAction} className="mt-6 grid gap-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <label className={labelClass}>
        Area
        <select name="areaId" defaultValue={AD_AREAS[0].id} className={inputClass}>
          {AD_AREAS.map((area) => (
            <option key={area.id} value={area.id}>{area.label}</option>
          ))}
        </select>
        <span className={hintClass}>More neighborhoods get added here as we pick them.</span>
      </label>

      <label className={labelClass}>
        Name
        <input name="name" className={inputClass} placeholder="Defaults to the area, e.g. Bentwater" />
      </label>

      <label className={labelClass}>
        Headline
        <input name="headline" required maxLength={80} defaultValue={DEFAULT_DRAFT.headline} className={inputClass} />
      </label>

      <label className={labelClass}>
        Ad text
        <textarea
          name="primaryText"
          required
          rows={5}
          maxLength={1000}
          defaultValue={DEFAULT_DRAFT.primaryText}
          className={inputClass}
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className={labelClass}>
          Button
          <select name="callToAction" defaultValue={DEFAULT_DRAFT.callToAction} className={inputClass}>
            {CALL_TO_ACTIONS.map((label) => <option key={label} value={label}>{label}</option>)}
          </select>
        </label>
        <label className={labelClass}>
          Daily budget
          <input name="dailyBudget" inputMode="decimal" className={inputClass} placeholder="Leave blank for now" />
          <span className={hintClass}>Dollars a day. Nothing is spent until you approve going live.</span>
        </label>
      </div>

      <label className={labelClass}>
        Offer
        <input name="offer" defaultValue={DEFAULT_DRAFT.offer} className={inputClass} />
      </label>

      <label className={labelClass}>
        Landing page
        <input name="landingPage" type="url" required defaultValue={DEFAULT_DRAFT.landingPage} className={inputClass} />
      </label>

      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="ui-action-primary rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save draft"}
        </button>
        <Link href="/ads" className="text-sm font-medium text-slate-600 hover:underline">Cancel</Link>
        <span className="text-sm text-slate-500">Saves a draft in SWapp only. Nothing goes to Facebook.</span>
      </div>
    </form>
  );
}

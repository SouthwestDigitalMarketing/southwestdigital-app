import { requestFinish } from "@/app/(app)/showrunner/editor/actions";

/** Finish and Add clips while Full auto is off at the gate (Tom, 2026-11-27). */
export function WaitingActions({
  batch,
  finishing,
}: {
  batch: string;
  finishing: boolean;
}) {
  if (finishing) {
    return (
      <p className="mt-4 max-w-3xl rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
        Starting the build. Takes about a minute.
      </p>
    );
  }
  return (
    <form action={requestFinish} className="mt-4 max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <input type="hidden" name="batch" value={batch} />
      <p className="text-sm font-semibold text-amber-950">Waiting on you</p>
      <p className="mt-1 text-sm text-amber-900">Send b-roll, or tap Finish to build this video now.</p>
      <label className="mt-3 block text-sm text-amber-900">
        Note for Johnny (optional)
        <textarea
          name="note"
          rows={2}
          maxLength={2000}
          placeholder="Open on the coffee shot"
          className="mt-1 w-full rounded-xl border border-amber-200 bg-white p-2 text-sm text-slate-900"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`/phone?addTo=${encodeURIComponent(batch)}`}
          className="inline-flex rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900"
        >
          Add clips
        </a>
        <button type="submit" className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">
          Finish
        </button>
      </div>
    </form>
  );
}

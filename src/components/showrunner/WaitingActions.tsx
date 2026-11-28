import { requestFinish } from "@/app/(app)/showrunner/editor/actions";

/** Add clips at any stage, including published. Finish only while a video is still waiting at the old gate. */
export function WaitingActions({
  batch,
  finishing,
  waiting = false,
  published = false,
}: {
  batch: string;
  finishing: boolean;
  waiting?: boolean;
  published?: boolean;
}) {
  if (finishing) {
    return (
      <p className="mt-4 text-sm text-slate-700">
        {published ? "Starting the recut. Takes about a minute." : "Starting the build. Takes about a minute."}
      </p>
    );
  }
  const addClips = (
    <a
      href={`/phone?addTo=${encodeURIComponent(batch)}`}
      className="inline-flex rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900"
    >
      Add clips
    </a>
  );
  if (!waiting) {
    return (
      <div className="mt-4">
        <p className="text-sm text-slate-700">
          {published
            ? "Need more b-roll? Add clips and Showrunner will recut this video, take the current YouTube upload down, and publish the new cut."
            : "Need more b-roll? Add clips and this video will recut from here."}
        </p>
        <div className="mt-3">{addClips}</div>
      </div>
    );
  }
  return (
    <form action={requestFinish} className="mt-4">
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
        {addClips}
        <button type="submit" className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">
          Finish
        </button>
      </div>
    </form>
  );
}

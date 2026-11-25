import { REVIEW_SECTIONS, type VideoReview } from "@/lib/showrunner/review";

function tone(points: number, max: number) {
  const share = max > 0 ? points / max : 0;
  return share >= 0.8 ? "bg-emerald-500" : share >= 0.5 ? "bg-amber-400" : "bg-rose-500";
}

/** The video's scorecard (All Thing sops/sop-video-scorecard.md): the total, each item with its reason, then the fixes. */
export function Scorecard({ review }: { review: VideoReview }) {
  const byId = new Map(review.items.map((item) => [item.id, item]));
  return (
    <section className="mt-4 max-w-3xl rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Scorecard</h2>
        <p className="text-sm text-slate-500">
          {new Date(review.reviewedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
        </p>
      </div>
      <p className="mt-1 text-4xl font-bold tabular-nums text-slate-900">
        {review.score}
        <span className="text-lg font-semibold text-slate-400">/100</span>
      </p>
      {review.fixNow.title || review.fixNow.thumbnailText || review.fixNow.notes.length ? (
        <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
          <h3 className="font-semibold">Fix now</h3>
          {review.fixNow.title ? <p className="mt-1">Title: <span className="font-semibold">{review.fixNow.title}</span></p> : null}
          {review.fixNow.thumbnailText ? <p className="mt-1">Thumbnail text: <span className="font-semibold">{review.fixNow.thumbnailText}</span></p> : null}
          {review.fixNow.notes.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">{review.fixNow.notes.map((note) => <li key={note}>{note}</li>)}</ul>
          ) : null}
        </div>
      ) : null}
      {review.nextTime ? (
        <div className="mt-3 rounded-xl bg-sky-50 p-3 text-sm text-sky-950">
          <h3 className="font-semibold">Next video</h3>
          <p className="mt-1">{review.nextTime}</p>
        </div>
      ) : null}
      {REVIEW_SECTIONS.map((section) => {
        const items = section.ids.map((id) => byId.get(id)).filter((item) => item !== undefined);
        if (items.length === 0) return null;
        const got = items.reduce((sum, item) => sum + item.points, 0);
        const most = items.reduce((sum, item) => sum + item.max, 0);
        return (
          <div key={section.name} className="mt-5">
            <h3 className="flex items-baseline justify-between text-sm font-semibold uppercase tracking-wide text-slate-500">
              <span>{section.name}</span>
              <span className="tabular-nums">{got}/{most}</span>
            </h3>
            <ul className="mt-2 flex flex-col gap-3">
              {items.map((item) => (
                <li key={item.id}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold text-slate-900">{item.title}</span>
                    <span className="shrink-0 tabular-nums text-slate-600">{item.points}/{item.max}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                    <div className={`h-1.5 rounded-full ${tone(item.points, item.max)}`} style={{ width: `${(100 * item.points) / Math.max(1, item.max)}%` }} />
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {item.at ? <span className="mr-1 font-semibold tabular-nums text-slate-500">{item.at}</span> : null}
                    {item.reason}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

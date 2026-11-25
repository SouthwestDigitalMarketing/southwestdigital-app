import Link from "next/link";
import { cookies } from "next/headers";
import { requireDonna } from "@/lib/donna/access";
import { loadActivity, storageMissing } from "@/lib/donna/store";
import { ACTIVITY_LABELS } from "@/lib/donna/domain";
import { activityPeriod, PERIODS } from "@/lib/donna/period";
import { privacyOn, PRIVACY_COOKIE } from "@/lib/privacy";
const GROUPS: Record<string, { label: string; keys: string[] }> = {
  overview: {
    label: "Overview",
    keys: ["reviewed", "handled", "draft-ready", "completed"],
  },
  sorting: {
    label: "Sorting",
    keys: ["spam", "rescued", "tagged", "untagged", "filed"],
  },
  replies: {
    label: "Documents and replies",
    keys: ["document", "draft-ready", "sent", "follow-up"],
  },
  requests: {
    label: "Requests",
    keys: ["request-opened", "answered", "completed", "reopened", "lead"],
  },
  quality: { label: "Quality", keys: ["corrected", "failed"] },
};
export const dynamic = "force-dynamic";
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    group?: string;
    kind?: string;
    page?: string;
  }>;
}) {
  const { dataContext } = await requireDonna();
  const p = await searchParams;
  const range =
    p.range && Object.hasOwn(PERIODS, p.range)
      ? (p.range as keyof typeof PERIODS)
      : "today";
  const group =
    p.group && Object.hasOwn(GROUPS, p.group) ? p.group : "overview";
  const kind =
    p.kind && Object.hasOwn(ACTIVITY_LABELS, p.kind) ? p.kind : undefined;
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt(p.page ?? "1") || 1),
  );
  const privacy = privacyOn((await cookies()).get(PRIVACY_COOKIE)?.value);
  const period = activityPeriod(range);
  let current, previous;
  try {
    [current, previous] = await Promise.all([
      loadActivity(dataContext, period.start, period.end, kind, page),
      loadActivity(dataContext, period.previousStart, period.previousEnd),
    ]);
  } catch (e) {
    if (!storageMissing(e)) throw e;
    return <div className="p-8">Email statistics are being set up.</div>;
  }
  const path = (r = range, g = group, k: string | null = kind ?? null, n = 1) =>
    `/scorecard/email?range=${r}&group=${g}${k ? `&kind=${k}&page=${n}` : ""}`;
  return (
    <div className="w-full min-w-0 space-y-3 px-4 py-5 text-slate-900 sm:p-8">
      <header className="space-y-2">
        <Link href="/scorecard" className="text-xs text-slate-500 underline">
          ← Scorecard
        </Link>
        <h1 className="text-xl font-semibold">Email scorecard</h1>
      </header>
      <nav aria-label="Scorecard period" className="flex gap-2">
        {Object.entries(PERIODS).map(([k, label]) => (
          <Link
            key={k}
            href={path(k as keyof typeof PERIODS, group, null)}
            aria-current={k === range ? "page" : undefined}
            className={`rounded-full px-3 py-2 text-xs ${k === range ? "bg-slate-900 text-white" : "bg-white text-slate-500"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {!kind ? (
        <>
          <form className="flex gap-2" method="get">
            <input name="range" type="hidden" value={range} />
            <label htmlFor="activity-group" className="sr-only">
              Activity group
            </label>
            <select
              id="activity-group"
              name="group"
              defaultValue={group}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white p-2 text-sm"
            >
              {Object.entries(GROUPS).map(([k, g]) => (
                <option key={k} value={k}>
                  {g.label}
                </option>
              ))}
            </select>
            <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              View
            </button>
          </form>
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 text-slate-500">
                <tr>
                  <th className="p-3">Activity</th>
                  <th className="p-3 text-right">{PERIODS[range]}</th>
                  <th className="p-3 text-right">Previous</th>
                </tr>
              </thead>
              <tbody>
                {GROUPS[group].keys.map((k) => (
                  <tr
                    key={k}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="p-3">
                      <Link
                        href={path(range, group, k)}
                        className="underline decoration-slate-300"
                      >
                        {ACTIVITY_LABELS[k]}
                      </Link>
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {current.counts[k] ?? 0}
                    </td>
                    <td className="p-3 text-right tabular-nums text-slate-500">
                      {previous.counts[k] ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <p className="text-xs text-slate-500">
            Verified results. Previous shows the full prior period. Reading and
            draft preparation only in this pilot.
          </p>
        </>
      ) : (
        <>
          <div className="flex justify-between gap-3">
            <h2 className="text-sm font-semibold">{ACTIVITY_LABELS[kind]}</h2>
            <Link className="text-xs underline" href={path(range, group, null)}>
              All counts
            </Link>
          </div>
          {!privacy ? (
            <>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                {current.recent.length ? (
                  current.recent.map((a) => (
                    <li key={a.id} className="p-3">
                      <p className="line-clamp-2 text-sm">
                        {a.request ? (
                          <Link
                            className="underline"
                            href={`/donna/requests/${a.request.id}`}
                          >
                            {a.request.title}
                          </Link>
                        ) : (
                          a.detail
                        )}
                      </p>
                      <details name="email-evidence" className="mt-2 text-xs">
                        <summary className="cursor-pointer text-slate-500">
                          Evidence
                        </summary>
                        <div
                          tabIndex={0}
                          className="mt-2 max-h-20 overflow-auto whitespace-pre-wrap break-words"
                        >
                          {a.evidence}
                        </div>
                      </details>
                    </li>
                  ))
                ) : (
                  <li className="p-4 text-sm text-slate-500">
                    No recorded activity.
                  </li>
                )}
              </ul>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">
                  {current.total
                    ? `${(page - 1) * 2 + 1}–${Math.min(page * 2, current.total)} of ${current.total}`
                    : "0 actions"}
                </span>
                <div className="flex gap-5">
                  {page > 1 ? (
                    <Link
                      className="underline"
                      href={path(range, group, kind, page - 1)}
                    >
                      Previous
                    </Link>
                  ) : null}
                  {page * 2 < current.total ? (
                    <Link
                      className="underline"
                      href={path(range, group, kind, page + 1)}
                    >
                      Next
                    </Link>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </>
      )}
      {privacy ? (
        <p className="text-xs text-slate-500">
          Privacy mode: counts only. Email details are hidden.
        </p>
      ) : null}
    </div>
  );
}

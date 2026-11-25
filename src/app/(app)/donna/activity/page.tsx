import Link from "next/link";
import { cookies } from "next/headers";
import { requireDonna } from "@/lib/donna/access";
import { loadActivity, storageMissing } from "@/lib/donna/store";
import { ACTIVITY_LABELS } from "@/lib/donna/domain";
import { activityPeriod, PERIODS } from "@/lib/donna/period";
import { privacyOn, PRIVACY_COOKIE } from "@/lib/privacy";

export const dynamic = "force-dynamic";
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; kind?: string }>;
}) {
  const { dataContext } = await requireDonna();
  const params = await searchParams;
  const range =
    params.range && Object.hasOwn(PERIODS, params.range)
      ? (params.range as keyof typeof PERIODS)
      : "today";
  const kind =
    params.kind && Object.hasOwn(ACTIVITY_LABELS, params.kind)
      ? params.kind
      : undefined;
  const privacy = privacyOn((await cookies()).get(PRIVACY_COOKIE)?.value);
  const period = activityPeriod(range);
  let current, previous;
  try {
    [current, previous] = await Promise.all([
      loadActivity(dataContext, period.start, period.end, kind),
      loadActivity(dataContext, period.previousStart, period.previousEnd),
    ]);
  } catch (e) {
    if (!storageMissing(e)) throw e;
    return (
      <main className="p-6">
        Donna’s Scorecard will appear after the database update is installed.
      </main>
    );
  }
  return (
    <main className="min-h-[calc(100dvh-3.5rem)] bg-slate-50 text-slate-900 break-words mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
      <Link className="text-sm underline" href="/donna">
        ← Donna
      </Link>
      <h1 className="text-2xl font-semibold">Donna scorecard</h1>
      <p className="text-sm text-slate-500">
        Verified results. Prepared replies, sent replies and finished requests
        are separate.
      </p>
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Read-only pilot: reviews and prepared replies are recorded. Filing,
        tagging and sending are not enabled.
      </p>
      <nav className="flex gap-2" aria-label="Scorecard period">
        {Object.entries(PERIODS).map(([key, label]) => (
          <Link
            key={key}
            href={`/donna/activity?range=${key}`}
            aria-current={range === key ? "page" : undefined}
            className={`rounded-full border px-4 py-2 text-sm ${key === range ? "bg-slate-900 text-white" : "bg-white"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <section className="rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b">
            <tr>
              <th className="p-3">What Donna handled</th>
              <th className="p-3 text-right">{PERIODS[range]}</th>
              <th className="p-3 text-right">Previous full period</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
              <tr key={key} className="border-b last:border-0">
                <td className="p-3">
                  <Link
                    className="underline decoration-slate-300"
                    href={`/donna/activity?range=${range}&kind=${key}`}
                  >
                    {label}
                  </Link>
                </td>
                <td className="p-3 text-right tabular-nums">
                  {current.counts[key] ?? 0}
                </td>
                <td className="p-3 text-right tabular-nums text-slate-500">
                  {previous.counts[key] ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="text-xs text-slate-500">
        Tagging and filing the same email count as two kinds of work, but one
        unique email per category. Retries do not add to the counts. Full-period
        comparisons include more elapsed time than a partial current period. No
        hours-saved estimate is invented.
      </p>
      {!privacy ? (
        <section>
          <h2 className="font-semibold">
            {kind ? ACTIVITY_LABELS[kind] : "Recent activity"}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Latest 100 matching actions in this period.
          </p>
          <ol className="mt-3 divide-y rounded-xl border border-slate-200 bg-white">
            {current.recent.length ? (
              current.recent.map((a) => (
                <li key={a.id} className="p-4 text-sm">
                  <p>
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
                  <p className="mt-1 text-xs text-slate-500">
                    {ACTIVITY_LABELS[a.kind] ?? a.kind} ·{" "}
                    {a.occurredAt.toLocaleString("en-US", {
                      timeZone: "America/Chicago",
                    })}
                  </p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs">
                      Evidence
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap text-xs">
                      {a.evidence}
                    </p>
                    <pre className="mt-2 whitespace-pre-wrap break-words text-xs">
                      {JSON.stringify(a.metadata, null, 2)}
                    </pre>
                  </details>
                </li>
              ))
            ) : (
              <li className="p-5 text-sm text-slate-500">
                No recorded activity in this period.
              </li>
            )}
          </ol>
        </section>
      ) : (
        <p className="text-sm text-slate-500">
          Privacy mode: counts only. Email details are hidden.
        </p>
      )}
    </main>
  );
}

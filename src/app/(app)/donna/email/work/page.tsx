import Link from "next/link";
import { requireDonna } from "@/lib/donna/access";
import { loadDesk } from "@/lib/donna/store";
import { STATES, TABS, type DonnaState } from "@/lib/donna/domain";
import { DonnaFrame } from "../../DonnaFrame";

export const dynamic = "force-dynamic";
export default async function WorkPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; page?: string }>;
}) {
  const p = await searchParams;
  const state = STATES.includes(p.state as DonnaState)
    ? (p.state as DonnaState)
    : "needs-you";
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt(p.page ?? "1") || 1),
  );
  const { dataContext } = await requireDonna();
  const data = await loadDesk(dataContext, state, page, 2);
  const count = data.groups.find((g) => g.state === state)?._count._all ?? 0;
  return (
    <DonnaFrame active="email">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {TABS[state]} <span className="text-slate-400">{count}</span>
        </h2>
        <Link href="/donna/email" className="text-sm text-slate-500 underline">
          Email summary
        </Link>
      </div>
      <nav aria-label="Filter email work" className="flex flex-wrap gap-2">
        {STATES.map((s) => (
          <Link
            key={s}
            href={`/donna/email/work?state=${s}`}
            aria-current={state === s ? "page" : undefined}
            className={`rounded-full px-3 py-2 text-xs ${state === s ? "bg-slate-900 text-white" : "bg-white text-slate-500"}`}
          >
            {TABS[s]}
          </Link>
        ))}
      </nav>
      {data.rows.length ? (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {data.rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/donna/requests/${r.id}`}
                className="block p-4 hover:bg-slate-50"
              >
                <p className="line-clamp-1 text-sm font-medium">
                  {r.urgent ? "Urgent · " : ""}
                  {r.title}
                </p>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {r.person}
                </p>
                <p className="mt-2 line-clamp-1 text-xs text-slate-600">
                  {r.nextAction}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">
          No requests in {TABS[state].toLowerCase()}.
        </p>
      )}
      <div className="flex min-h-10 items-center justify-between text-sm">
        <span className="text-xs text-slate-400">
          {count
            ? `${(page - 1) * 2 + 1}–${Math.min(page * 2, count)} of ${count}`
            : "0 requests"}
        </span>
        <div className="flex gap-5">
          {page > 1 ? (
            <Link
              className="underline"
              href={`/donna/email/work?state=${state}&page=${page - 1}`}
            >
              Previous
            </Link>
          ) : null}
          {page * 2 < count ? (
            <Link
              className="underline"
              href={`/donna/email/work?state=${state}&page=${page + 1}`}
            >
              Next
            </Link>
          ) : null}
        </div>
      </div>
    </DonnaFrame>
  );
}

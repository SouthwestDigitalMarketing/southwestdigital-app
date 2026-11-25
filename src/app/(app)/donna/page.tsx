import Link from "next/link";
import { requireDonna } from "@/lib/donna/access";
import { loadDesk, storageMissing } from "@/lib/donna/store";
import {
  mailboxHealth,
  coverageLabel,
  STATES,
  TABS,
  type DonnaState,
} from "@/lib/donna/domain";
import { mailboxAction } from "./actions";
import { RefreshDonna } from "./refresh";

export const dynamic = "force-dynamic";
export default async function DonnaPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const { dataContext } = await requireDonna();
  const params = await searchParams;
  const tab = STATES.includes(params.tab as DonnaState)
    ? (params.tab as DonnaState)
    : "needs-you";
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt(params.page ?? "1") || 1),
  );
  let data;
  try {
    data = await loadDesk(dataContext, tab, page);
  } catch (error) {
    if (!storageMissing(error)) throw error;
    return (
      <main className="p-6">
        <h1 className="text-2xl font-semibold">Donna</h1>
        <p className="mt-4">
          Donna’s email desk is being set up. The database update is not
          installed here yet.
        </p>
      </main>
    );
  }
  const counts = Object.fromEntries(
    data.groups.map((g) => [g.state, g._count._all]),
  );
  return (
    <main className="min-h-[calc(100dvh-3.5rem)] bg-slate-50 text-slate-900 break-words mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
      <RefreshDonna />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Donna</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your email desk. Work owned, decisions prepared, follow-through
            tracked.
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <Link className="underline" href="/donna/activity">
            Scorecard
          </Link>
          <Link className="underline" href="/donna/settings">
            Settings
          </Link>
        </div>
      </header>
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Read-only pilot. Donna is preparing recommendations. She has not moved,
        tagged or sent your mail.
      </p>
      {data.mailboxes.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold">Connect the email desk</h2>
          <p className="mt-2 text-sm text-slate-600">
            Start with your existing Zoho mailbox. Donna begins paused so you
            can review the setup.
          </p>
          <Link
            href="/donna/settings"
            className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
          >
            Set up Donna
          </Link>
        </section>
      ) : (
        <section
          className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
          aria-label="Mailbox health"
        >
          {data.mailboxes.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {m.address} · {mailboxHealth(m)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Last mailbox check:{" "}
                  {m.lastCheckedAt
                    ? m.lastCheckedAt.toLocaleString("en-US", {
                        timeZone: "America/Chicago",
                      })
                    : "Not checked yet"}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {coverageLabel(m.coverage)}
                </p>
                {m.lastError ? (
                  <p role="alert" className="mt-1 text-sm text-red-700">
                    {m.lastError}
                  </p>
                ) : null}
              </div>
              <form action={mailboxAction}>
                <input type="hidden" name="mailboxId" value={m.id} />
                <button
                  name="action"
                  value="check"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  Check now
                </button>
              </form>
            </div>
          ))}
          <p className="text-xs text-slate-500">
            Coverage and connection details are in Settings.
          </p>
        </section>
      )}
      <section className="rounded-xl bg-slate-100 p-4">
        <h2 className="text-sm font-semibold">Today’s desk</h2>
        <p className="mt-1 text-sm">
          {counts["needs-you"] ?? 0} need your judgment · {counts.working ?? 0}{" "}
          working · {counts.waiting ?? 0} waiting
        </p>
      </section>
      <nav aria-label="Donna work" className="flex flex-wrap gap-2">
        {STATES.map((s) => (
          <Link
            key={s}
            href={`/donna?tab=${s}`}
            aria-current={tab === s ? "page" : undefined}
            className={`rounded-full border border-slate-200 px-3 py-2 text-xs sm:px-4 sm:text-sm ${tab === s ? "bg-slate-900 text-white" : "bg-white"}`}
          >
            {TABS[s]}{" "}
            <span className="ml-1 tabular-nums">{counts[s] ?? 0}</span>
          </Link>
        ))}
      </nav>
      <section aria-label={TABS[tab]}>
        {data.rows.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-sm text-slate-500">
            {data.mailboxes.length
              ? `No requests in ${TABS[tab].toLowerCase()}. Check mailbox coverage before treating the desk as clear.`
              : "Your requests will appear here after Donna reads the mailbox."}
          </p>
        ) : (
          <ul className="divide-y rounded-xl border border-slate-200 bg-white">
            {data.rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/donna/requests/${r.id}`}
                  className="block space-y-2 p-4 hover:bg-slate-50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {r.urgent ? "Urgent · " : ""}
                      {r.title}
                    </span>
                    <span className="text-xs text-slate-500">
                      {r.owner} · {r.category}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{r.person}</p>
                  <p className="text-sm">{r.nextAction}</p>
                  {r.waitingOn ? (
                    <p className="text-xs text-slate-500">
                      Waiting on {r.waitingOn}
                    </p>
                  ) : null}
                  {r.followUpAt || r.dueAt ? (
                    <p
                      className={`text-xs ${(r.followUpAt ?? r.dueAt)! < new Date() && r.state !== "handled" ? "text-red-700" : "text-slate-500"}`}
                    >
                      {r.followUpAt ? "Follow-up" : "Due"}:{" "}
                      {(r.followUpAt ?? r.dueAt)!.toLocaleString("en-US", {
                        timeZone: "America/Chicago",
                      })}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="flex gap-5 text-sm">
        {page > 1 ? (
          <Link
            className="underline"
            href={`/donna?tab=${tab}&page=${page - 1}`}
          >
            Previous
          </Link>
        ) : null}
        {page * 50 < (counts[tab] ?? 0) ? (
          <Link
            className="underline"
            href={`/donna?tab=${tab}&page=${page + 1}`}
          >
            More requests
          </Link>
        ) : null}
      </div>
    </main>
  );
}

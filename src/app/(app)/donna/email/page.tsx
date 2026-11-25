import Link from "next/link";
import { requireDonna } from "@/lib/donna/access";
import { loadDesk, storageMissing } from "@/lib/donna/store";
import { STATES, TABS, mailboxHealth } from "@/lib/donna/domain";
import { DonnaFrame, shortTime } from "../DonnaFrame";

export const dynamic = "force-dynamic";
export default async function EmailPage() {
  const { dataContext } = await requireDonna();
  let data;
  try {
    data = await loadDesk(dataContext, "needs-you");
  } catch (e) {
    if (!storageMissing(e)) throw e;
    return (
      <DonnaFrame active="email">
        <p className="text-sm">The email desk is being set up.</p>
      </DonnaFrame>
    );
  }
  const counts = Object.fromEntries(
    data.groups.map((g) => [g.state, g._count._all]),
  );
  const m = data.mailboxes[0];
  const remaining = data.mailboxes.reduce(
    (n, b) =>
      n +
      Number(
        (b.coverage as { remaining_threads?: number })?.remaining_threads ?? 0,
      ),
    0,
  );
  const health = m ? mailboxHealth(m) : "Not connected";
  return (
    <DonnaFrame active="email">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Email</h2>
        <span
          className={`rounded-full px-3 py-1 text-xs ${m?.lastError ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}
        >
          {m?.paused
            ? "Paused"
            : health.startsWith("Listening")
              ? "Listening"
              : health}
        </span>
      </div>
      {m ? (
        <p className="truncate text-sm text-slate-500" title={m.address}>
          {m.address}
        </p>
      ) : (
        <Link
          href="/donna/settings"
          className="inline-block rounded-lg bg-slate-900 px-4 py-3 text-sm text-white"
        >
          Connect email
        </Link>
      )}
      <section
        aria-label="Email work"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {STATES.map((s) => (
          <Link
            key={s}
            href={`/donna/email/work?state=${s}`}
            className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-400"
          >
            <span className="block text-2xl font-semibold tabular-nums">
              {counts[s] ?? 0}
            </span>
            <span className="mt-1 block text-xs text-slate-500">{TABS[s]}</span>
          </Link>
        ))}
      </section>
      <section
        aria-label="Email status"
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm"
      >
        <div className="flex justify-between gap-3">
          <span className="text-slate-500">Last checked</span>
          <span>{shortTime(m?.lastCheckedAt ?? null)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-slate-500">History to review</span>
          <Link
            href="/donna/settings?section=coverage"
            className="font-medium underline decoration-slate-300"
          >
            {remaining.toLocaleString("en-US")} conversations
          </Link>
        </div>
        {m?.lastError ? (
          <p role="alert" className="line-clamp-2 text-xs text-rose-700">
            {m.lastError}
          </p>
        ) : null}
      </section>
      <Link
        href="/donna/settings"
        className="inline-block text-sm text-slate-600 underline decoration-slate-300"
      >
        Manage email
      </Link>
    </DonnaFrame>
  );
}

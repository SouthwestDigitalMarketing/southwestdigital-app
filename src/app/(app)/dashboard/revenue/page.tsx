import Link from "next/link";
import { getRecordMrr } from "@/lib/operations/serviceRecordsMrr";
import { requireAppBrand } from "@/lib/brands/staff";
import { getPastDueByContact } from "@/lib/ar/pastDue";
import { summarizeMrr } from "../utils";
import { HistoryBackLink } from "@/components/HistoryBackLink";

export const dynamic = "force-dynamic";

function fmtMoney(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default async function RevenuePage() {
  const { brand } = await requireAppBrand();
  // From service records (signed agreements), not the hand-typed Contact.mrrUsd.
  const { clients, starting, mismatches } = await getRecordMrr(brand.id);
  const { total, count, average } = summarizeMrr(clients.map((client) => client.mrr));
  const todayKey = new Date().toISOString().slice(0, 10);
  const { byId: pastDue } = await getPastDueByContact(brand.id, clients, todayKey);

  return (
    <div className="px-4 py-5 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <HistoryBackLink fallbackHref="/dashboard" className="text-xs text-slate-400 hover:underline" />
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Revenue</h1>
        <p className="mt-1 text-sm text-slate-500">
          {fmtMoney(total)}/mo across {count.toLocaleString("en-US")} client{count === 1 ? "" : "s"}
          {count > 0 ? ` · ${fmtMoney(Math.round(average * 100) / 100)} average` : ""}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Clients with an active recurring service tag; fees from their signed agreements (service records) active today.
        </p>

        {clients.length > 0 ? (
          <ul className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {clients.map((client) => {
              const overdue = pastDue[client.id]?.pastDue ?? 0;
              return (
                <li key={client.id} className="border-b border-slate-100 last:border-b-0">
                  <Link
                    href={`/contacts/${client.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">{client.name}</span>
                      {client.company ? (
                        <span className="block truncate text-xs text-slate-400">{client.company}</span>
                      ) : null}
                      {overdue > 0 ? (
                        <span className="block text-xs font-semibold text-rose-600">
                          {fmtMoney(overdue)} past due
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={`shrink-0 text-sm font-semibold tabular-nums ${overdue > 0 ? "text-rose-700" : "text-slate-900"}`}
                    >
                      {fmtMoney(client.mrr)}/mo
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
            No active monthly service records.
          </p>
        )}

        {mismatches.length > 0 ? (
          <>
            <h2 id="mismatches" className="mt-6 text-sm font-semibold text-amber-700">
              Mismatches · {mismatches.length}
            </h2>
            <ul className="mt-2 overflow-hidden rounded-xl border border-amber-200 bg-white">
              {mismatches.map((item) => (
                <li key={`${item.id}-${item.problem}`} className="border-b border-slate-100 last:border-b-0">
                  <Link
                    href={`/contacts/${item.id}`}
                    className="block px-4 py-3 transition-colors hover:bg-slate-50"
                  >
                    <span className="block truncate text-sm font-semibold text-slate-900">{item.name}</span>
                    <span className="block text-xs text-amber-700">{item.problem}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {starting.length > 0 ? (
          <>
            <h2 className="mt-6 text-sm font-semibold text-slate-700">
              Signed, starting · {fmtMoney(starting.reduce((sum, client) => sum + client.mrr, 0))}/mo
            </h2>
            <ul className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {starting.map((client) => (
                <li key={`${client.id}-${client.startDate}`} className="border-b border-slate-100 last:border-b-0">
                  <Link
                    href={`/contacts/${client.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">{client.name}</span>
                      <span className="block truncate text-xs text-slate-400">
                        Starts{" "}
                        {new Date(`${client.startDate}T12:00:00Z`).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          timeZone: "UTC",
                        })}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-500">{fmtMoney(client.mrr)}/mo</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}

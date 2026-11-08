import Link from "next/link";
import { prisma } from "@/lib/prisma";
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
  const rows = await prisma.contact.findMany({
    where: { brandId: brand.id, isActive: true, mrrUsd: { not: null } },
    select: { id: true, name: true, company: true, mrrUsd: true },
    orderBy: [{ mrrUsd: "desc" }, { name: "asc" }],
  });
  const clients = rows.map((row) => ({ id: row.id, name: row.name, company: row.company, mrr: Number(row.mrrUsd) }));
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
            No clients carry monthly revenue yet.
          </p>
        )}
      </div>
    </div>
  );
}

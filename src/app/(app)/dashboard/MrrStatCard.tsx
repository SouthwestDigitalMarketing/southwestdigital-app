"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, DollarSign } from "lucide-react";

export type MrrClient = {
  id: string;
  name: string;
  company: string | null;
  mrr: number;
};

function fmtMoney(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function MrrStatCard({
  label,
  value,
  clients,
}: {
  label: string;
  value: string;
  clients: MrrClient[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex flex-col rounded-xl border border-slate-200 bg-white p-3 sm:col-span-2 sm:p-6 lg:col-span-1">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={open ? "Hide client breakdown" : "Show client breakdown"}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="min-w-0">
          <span className="flex min-w-0 items-start gap-1.5 text-slate-400">
            <DollarSign size={14} className="mt-0.5 shrink-0" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
              {label}
            </span>
          </span>
          <span
            className="mt-1 block text-2xl font-semibold tabular-nums sm:mt-2 sm:text-3xl"
            style={{ color: "var(--text-primary)" }}
          >
            {value}
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="mt-2 border-t border-slate-100 pt-2">
          <Link
            href="/dashboard/revenue"
            className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          >
            Detail
            <ChevronRight size={16} className="text-slate-400" />
          </Link>
          {clients.length > 0 ? (
            <ul className="mt-1 divide-y divide-slate-100">
              {clients.map((client) => (
                <li key={client.id}>
                  <Link
                    href={`/contacts/${client.id}`}
                    className="flex items-center justify-between gap-3 px-1 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-800">
                        {client.name}
                      </span>
                      {client.company ? (
                        <span className="block truncate text-xs text-slate-400">{client.company}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                      {fmtMoney(client.mrr)}/mo
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-1 py-2 text-sm text-slate-500">No clients carry monthly revenue yet.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

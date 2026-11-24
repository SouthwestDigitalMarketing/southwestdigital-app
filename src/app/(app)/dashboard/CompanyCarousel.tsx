"use client";

import { useState } from "react";
import type { MetricsView } from "@/lib/companyMetrics/summary";

type CashFlow = { month: string; asOf: string; valueUsd: number; stale: boolean } | null;

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function response(value: number | null) {
  if (value === null) return "No replies yet";
  if (value < 3600) return `${Math.round(value / 60)} min`;
  return `${(value / 3600).toFixed(1)} hr`;
}

type Part = { slug: string; name: string; value: number; display: string; color: string };

/** A thin bar split by brand; tap a piece (or hover) to read it. Pieces are drawn only for amounts above zero. */
function SplitBar({ parts, label }: { parts: Part[]; label: string }) {
  const [picked, setPicked] = useState<string | null>(null);
  const total = parts.reduce((n, p) => n + Math.max(0, p.value), 0);
  const shown = parts.find((p) => p.slug === picked);
  return (
    <div className="mt-2.5">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${label} by brand: ${parts.map((p) => `${p.name} ${p.display}`).join(", ")}`}>
        {total > 0
          ? parts.filter((p) => p.value > 0).map((p) => (
            <button
              key={p.slug}
              type="button"
              title={`${p.name}: ${p.display}`}
              onClick={() => setPicked(picked === p.slug ? null : p.slug)}
              className="brand-split-seg h-full"
              style={{ width: `${(p.value / total) * 100}%`, ["--seg" as string]: p.color }}
            />
          ))
          : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {parts.map((p) => (
          <button key={p.slug} type="button" onClick={() => setPicked(picked === p.slug ? null : p.slug)} className="inline-flex items-center gap-1.5">
            <span className="brand-split-seg h-2.5 w-2.5 rounded-full" style={{ ["--seg" as string]: p.color }} />
            <span className={picked === p.slug ? "font-semibold text-slate-900" : undefined}>{p.name}</span>
            <span className="font-semibold tabular-nums text-slate-900">{p.display}</span>
          </button>
        ))}
      </div>
      {shown && total > 0 ? (
        <p className="mt-1 text-xs text-slate-500">{shown.name}: {Math.round((Math.max(0, shown.value) / total) * 100)}% of the total</p>
      ) : null}
    </div>
  );
}

function Card({ label, value, note, parts }: { label: string; value: string; note: string; parts?: Part[] }) {
  // The label follows the value on one line ("4 new leads") to save height (Tom, 2026-11-24).
  return <div className="flex flex-col rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
    <p className="flex flex-wrap items-baseline gap-x-2">
      <span className="text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</span>
      <span className="text-base font-medium text-slate-600">{label}</span>
    </p>
    <p className="mt-0.5 text-sm text-slate-500">{note}</p>
    {parts ? <SplitBar parts={parts} label={label} /> : null}
  </div>;
}

/**
 * Lochside's company numbers on one screen (Tom, 2026-11-24): each card shows the total, then a bar split by
 * brand in the brand's colour (Bookkeeping Conroe navy, The Real Estate Bookkeeper red) instead of a swipe per brand.
 */
export function CompanyCarousel({ total, brands, cashFlow, expectedMonth, period, colors }: {
  total: MetricsView; brands: MetricsView[]; cashFlow: CashFlow; expectedMonth: string; period: string;
  colors: Record<string, string>;
}) {
  const parts = (pick: (b: MetricsView) => number, show: (n: number) => string): Part[] =>
    brands.map((b) => ({ slug: b.slug, name: b.name, value: pick(b), display: show(pick(b)), color: colors[b.slug] ?? "#64748b" }));
  const count = (n: number) => String(n);
  return <section className="mt-2">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card label="monthly recurring revenue" value={money(total.mrrUsd)} note={`${total.clients} active client${total.clients === 1 ? "" : "s"}`} parts={parts((b) => b.mrrUsd, money)} />
      <Card label="new leads" value={String(total.newLeads)} note={period} parts={parts((b) => b.newLeads, count)} />
      <Card label="offers" value={String(total.offersSent)} note={`${total.offersAwaiting} awaiting a reply`} parts={parts((b) => b.offersSent, count)} />
      <Card
        label="response time"
        value={response(total.medianResponseSeconds)}
        note={`Median business time · ${brands.map((b) => `${b.name} ${response(b.medianResponseSeconds)}`).join(" · ")}`}
      />
      <div className="sm:col-span-2 xl:col-span-4">
        <Card label="free cash flow" value={cashFlow ? money(cashFlow.valueUsd) : "Awaiting closed books"} note={cashFlow ? `As of ${cashFlow.asOf}${cashFlow.stale ? ` · Books behind (${expectedMonth} expected)` : ""}` : `No verified closed month · ${expectedMonth} expected`} />
      </div>
    </div>
  </section>;
}

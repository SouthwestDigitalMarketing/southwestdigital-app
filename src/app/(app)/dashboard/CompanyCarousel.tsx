"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

/**
 * A thin bar split by brand, no legend (Tom, 2026-11-24). Tap the bar for what makes up the number: each brand's
 * amount and share, in a small pop-up over the card; tap again or anywhere else to close it.
 */
function SplitBar({ parts, label }: { parts: Part[]; label: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const total = parts.reduce((n, p) => n + Math.max(0, p.value), 0);
  const share = (p: Part) => (total > 0 ? Math.round((Math.max(0, p.value) / total) * 100) : 0);
  const summary = parts.map((p) => `${p.name} ${p.display} (${share(p)}%)`).join(", ");
  return (
    // z-10 keeps the bar tappable above the card's own link.
    <div ref={box} className="relative z-10 mt-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`${label} by brand: ${summary}`}
        title={summary}
        className="flex w-full py-1.5"
      >
        <span className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          {total > 0
            ? parts.filter((p) => p.value > 0).map((p) => (
              <span key={p.slug} className="brand-split-seg h-full" style={{ width: `${(p.value / total) * 100}%`, ["--seg" as string]: p.color }} />
            ))
            : null}
        </span>
      </button>
      {open ? (
        <div role="status" className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg">
          {parts.map((p) => (
            <p key={p.slug} className="flex items-center gap-2 py-0.5">
              <span className="brand-split-seg h-2.5 w-2.5 shrink-0 rounded-full" style={{ ["--seg" as string]: p.color }} />
              <span className="min-w-0 flex-1 text-slate-700">{p.name}</span>
              <span className="font-semibold tabular-nums text-slate-900">{p.display}</span>
              <span className="w-10 text-right tabular-nums text-slate-500">{share(p)}%</span>
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** A whole card is a link to the page about that number (Tom, 2026-11-24); the bar keeps its own tap. */
function Card({ label, value, note, parts, href }: { label: string; value: string; note: string; parts?: Part[]; href?: string }) {
  return <div className={`relative flex flex-col rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm ${href ? "transition-colors hover:border-slate-400" : ""}`}>
    {href ? <Link href={href} aria-label={`${value} ${label}: open`} className="absolute inset-0 rounded-2xl" /> : null}
    {/* The label follows the value on one line ("4 new leads") to save height. */}
    <p className="flex flex-wrap items-baseline gap-x-2 pr-6">
      <span className="text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</span>
      <span className="text-base font-medium text-slate-600">{label}</span>
    </p>
    {href ? <ChevronRight aria-hidden="true" size={18} className="absolute right-4 top-5 text-slate-400" /> : null}
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
      <Card label="MRR" value={money(total.mrrUsd)} note={`${total.clients} active client${total.clients === 1 ? "" : "s"}`} parts={parts((b) => b.mrrUsd, money)} href="/dashboard/revenue" />
      <Card label="new leads" value={String(total.newLeads)} note={period} parts={parts((b) => b.newLeads, count)} href="/pipeline" />
      <Card label="offers" value={String(total.offersSent)} note={`${total.offersAwaiting} awaiting a reply`} parts={parts((b) => b.offersSent, count)} href="/offers" />
      <Card
        label="response time"
        value={response(total.medianResponseSeconds)}
        note={`Median business time · ${brands.map((b) => `${b.name} ${response(b.medianResponseSeconds)}`).join(" · ")}`}
        href="/scorecard"
      />
      <div className="sm:col-span-2 xl:col-span-4">
        <Card label="free cash flow" value={cashFlow ? money(cashFlow.valueUsd) : "Awaiting closed books"} note={cashFlow ? `As of ${cashFlow.asOf}${cashFlow.stale ? ` · Books behind (${expectedMonth} expected)` : ""}` : `No verified closed month · ${expectedMonth} expected`} />
      </div>
    </div>
  </section>;
}

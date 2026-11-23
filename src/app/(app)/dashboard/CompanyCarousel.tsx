"use client";

import { ExternalLink } from "lucide-react";
import type { MetricsView } from "@/lib/companyMetrics/summary";
import { BrandSwipe } from "@/components/BrandSwipe";
import { NEUTRAL_SWIPE_PALETTE, type SwipePalette } from "@/lib/brands/swipePalette";

type CashFlow = { month: string; asOf: string; valueUsd: number; stale: boolean } | null;

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function response(value: number | null) {
  if (value === null) return "No replies yet";
  if (value < 3600) return `${Math.round(value / 60)} min`;
  return `${(value / 3600).toFixed(1)} hr`;
}

function Card({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="brand-swipe__card flex min-h-32 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
    <div><p className="text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p><p className="mt-1 text-sm text-slate-500">{note}</p></div>
  </div>;
}

export function CompanyCarousel({ total, brands, cashFlow, expectedMonth, period, palettes }: {
  total: MetricsView; brands: MetricsView[]; cashFlow: CashFlow; expectedMonth: string; period: string;
  palettes: Record<string, SwipePalette>;
}) {
  const views = [total, ...brands].map((slide, index) => ({
    key: slide.slug,
    name: index === 0 ? "Total" : slide.name,
    heading: slide.name,
    palette: index === 0 ? NEUTRAL_SWIPE_PALETTE : palettes[slide.slug] ?? NEUTRAL_SWIPE_PALETTE,
    content: <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card label="Monthly recurring revenue" value={money(slide.mrrUsd)} note={`${slide.clients} active client${slide.clients === 1 ? "" : "s"}`} />
        <Card label="New leads" value={String(slide.newLeads)} note={period} />
        <Card label="Offers" value={String(slide.offersSent)} note={`${slide.offersAwaiting} awaiting a reply`} />
        <Card label="Response time" value={response(slide.medianResponseSeconds)} note={`Median business time · ${period.toLowerCase()}`} />
        {index === 0 && <div className="sm:col-span-2 xl:col-span-4"><Card label="Free cash flow" value={cashFlow ? money(cashFlow.valueUsd) : "Awaiting closed books"} note={cashFlow ? `As of ${cashFlow.asOf}${cashFlow.stale ? ` · Books behind (${expectedMonth} expected)` : ""}` : `No verified closed month · ${expectedMonth} expected`} /></div>}
      </div>
      <div className="mt-4 min-h-6 text-sm text-slate-500">{slide.website && <a href={slide.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">Visit {slide.name}&apos;s website <ExternalLink size={13}/></a>}</div>
    </>,
  }));
  return <section className="mt-5">
    <p className="mb-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">One company · two brands</p>
    <BrandSwipe label="Lochside company dashboard" views={views} />
  </section>;
}

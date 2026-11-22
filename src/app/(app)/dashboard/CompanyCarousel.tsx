"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
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

function Card({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="flex min-h-32 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
    <div><p className="text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p><p className="mt-1 text-sm text-slate-500">{note}</p></div>
  </div>;
}

export function CompanyCarousel({ total, brands, cashFlow, expectedMonth, period }: {
  total: MetricsView; brands: MetricsView[]; cashFlow: CashFlow; expectedMonth: string; period: string;
}) {
  const slides = [total, ...brands];
  const [active, setActive] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const move = (index: number) => {
    const next = Math.max(0, Math.min(slides.length - 1, index));
    track.current?.children[next]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    setActive(next);
  };
  return <section aria-label="Lochside company dashboard" className="mt-5">
    <div className="flex items-center justify-between gap-3">
      <div><p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">One company · two brands</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{slides[active].name}</h2></div>
      <div className="hidden gap-1 sm:flex"><button onClick={() => move(active - 1)} disabled={active === 0} aria-label="Previous view" className="rounded-full border p-2 disabled:opacity-30"><ChevronLeft size={18}/></button><button onClick={() => move(active + 1)} disabled={active === slides.length - 1} aria-label="Next view" className="rounded-full border p-2 disabled:opacity-30"><ChevronRight size={18}/></button></div>
    </div>
    <div className="mt-4 hidden gap-2 sm:flex" role="tablist" aria-label="Company views">{slides.map((slide, index) => <button key={slide.slug} role="tab" aria-selected={index === active} onClick={() => move(index)} className={`rounded-full px-4 py-2 text-sm ${index === active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>{index === 0 ? "Total" : slide.name}</button>)}</div>
    <div ref={track} onScroll={() => { const el = track.current; if (el) setActive(Math.round(el.scrollLeft / el.clientWidth)); }} className="mt-4 flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none]" style={{ scrollbarWidth: "none" }}>
      {slides.map((slide, index) => <div key={slide.slug} className="w-full shrink-0 snap-start px-px" aria-label={`${slide.name} metrics`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card label="Monthly recurring revenue" value={money(slide.mrrUsd)} note={`${slide.clients} active client${slide.clients === 1 ? "" : "s"}`} />
          <Card label="New leads" value={String(slide.newLeads)} note={period} />
          <Card label="Offers" value={String(slide.offersSent)} note={`${slide.offersAwaiting} awaiting a reply`} />
          <Card label="Response time" value={response(slide.medianResponseSeconds)} note={`Median business time · ${period.toLowerCase()}`} />
          {index === 0 && <div className="sm:col-span-2 xl:col-span-4"><Card label="Free cash flow" value={cashFlow ? money(cashFlow.valueUsd) : "Awaiting closed books"} note={cashFlow ? `As of ${cashFlow.asOf}${cashFlow.stale ? ` · Books behind (${expectedMonth} expected)` : ""}` : `No verified closed month · ${expectedMonth} expected`} /></div>}
        </div>
        <div className="mt-4 min-h-6 text-sm text-slate-500">{slide.website && <a href={slide.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">Visit {slide.name}&apos;s website <ExternalLink size={13}/></a>}</div>
      </div>)}
    </div>
    <div className="mt-1 flex justify-center gap-2 sm:hidden" aria-label="View position">{slides.map((slide, index) => <button key={slide.slug} aria-label={`Show ${slide.name}`} aria-current={active === index ? "true" : undefined} onClick={() => move(index)} className={`h-2 w-2 rounded-full ${active === index ? "bg-slate-900" : "bg-slate-300"}`}/>)}</div>
  </section>;
}

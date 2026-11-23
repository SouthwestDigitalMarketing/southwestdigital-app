"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { NEUTRAL_SWIPE_PALETTE, type SwipePalette } from "@/lib/brands/swipePalette";

export type BrandSwipeView = { key: string; name: string; heading?: string; content: ReactNode; palette?: SwipePalette };

function paletteStyle(palette: SwipePalette): CSSProperties {
  return {
    "--swipe-light-ink": palette.lightInk,
    "--swipe-dark-ink": palette.darkInk,
    "--swipe-light-accent": palette.lightAccent,
    "--swipe-dark-accent": palette.darkAccent,
    "--swipe-light-tab": palette.lightTab,
    "--swipe-dark-tab": palette.darkTab,
    "--swipe-light-tab-text": palette.lightTabText,
    "--swipe-dark-tab-text": palette.darkTabText,
  } as CSSProperties;
}

export function BrandSwipe({ views, label }: { views: BrandSwipeView[]; label: string }) {
  const [active, setActive] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const move = (index: number) => {
    const next = Math.max(0, Math.min(views.length - 1, index));
    track.current?.children[next]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    setActive(next);
  };
  return <section aria-label={label} className="brand-swipe" style={paletteStyle(views[active]?.palette ?? NEUTRAL_SWIPE_PALETTE)}>
    <div className="flex items-center justify-between gap-3">
      <h2 className="brand-swipe__heading text-2xl font-semibold tracking-tight">{views[active].heading ?? views[active].name}</h2>
      <div className="hidden gap-1 sm:flex">
        <button type="button" onClick={() => move(active - 1)} disabled={active === 0} aria-label="Previous view" className="rounded-full border p-2 disabled:opacity-30"><ChevronLeft size={18}/></button>
        <button type="button" onClick={() => move(active + 1)} disabled={active === views.length - 1} aria-label="Next view" className="rounded-full border p-2 disabled:opacity-30"><ChevronRight size={18}/></button>
      </div>
    </div>
    <div className="mt-4 hidden gap-2 sm:flex" role="tablist" aria-label={`${label} views`}>{views.map((view, index) => <button key={view.key} type="button" role="tab" aria-selected={index === active} onClick={() => move(index)} className={`brand-swipe__tab rounded-full px-4 py-2 text-sm ${index === active ? "" : "bg-slate-100 text-slate-600"}`}>{view.name}</button>)}</div>
    <div className="mt-3 flex items-center justify-between sm:hidden"><p className="text-xs text-slate-500">Swipe to see each view</p><div className="flex gap-2" aria-label="View position">{views.map((view, index) => <button key={view.key} type="button" aria-label={`Show ${view.name}`} aria-current={active === index ? "true" : undefined} onClick={() => move(index)} className={`brand-swipe__dot h-2.5 w-2.5 rounded-full ${active === index ? "" : "bg-slate-300"}`}/>)}</div></div>
    <div ref={track} onScroll={() => { const el = track.current; if (el) setActive(Math.round(el.scrollLeft / el.clientWidth)); }} className="mt-4 flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none]" style={{ scrollbarWidth: "none" }}>
      {views.map((view) => <div key={view.key} className="brand-swipe w-full shrink-0 snap-start px-px" style={paletteStyle(view.palette ?? NEUTRAL_SWIPE_PALETTE)} aria-label={`${view.name} view`}>{view.content}</div>)}
    </div>
  </section>;
}

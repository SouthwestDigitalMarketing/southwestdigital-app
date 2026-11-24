"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import type { BillingCalendarDay, BillingEvent } from "@/lib/dashboard/billing-timers";

const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const EVENT_STYLE: Record<BillingEvent, { dot: string; text: string; label: string; detail: string }> = {
  payday: {
    dot: "bg-emerald-600 text-white",
    text: "text-emerald-700",
    label: "Payday",
    detail: "The 1st. Clients pay their invoice.",
  },
  reminders: {
    // Light green with the payday green as its border (Tom, 2026-11-24).
    dot: "border-2 border-emerald-600 bg-emerald-50 text-emerald-800",
    text: "text-emerald-700",
    label: "Invoice reminders go out",
    detail: "3 days before the last day of the month. Clients hear their invoice is coming.",
  },
  late_fees: {
    dot: "bg-rose-600 text-white",
    text: "text-rose-700",
    label: "Late fees applied",
    detail: "The 8th. Invoices still unpaid after 7 days get the late fee.",
  },
};

function monthOf(date: string) {
  return MONTH[Number(date.slice(5, 7)) - 1];
}

function countdown(offset: number) {
  return offset === 0 ? "Today" : `${offset}d`;
}

/**
 * One swipeable row of days: 10 visible on a phone, more on wider screens.
 * Opens with yesterday at the left edge; both edges fade out. A double-tap
 * (double-click on desktop) scrolls back there. Past days are dimmed.
 */
export function BillingCalendarStrip({ days, releases = {} }: { days: BillingCalendarDay[]; releases?: Record<string, number> }) {
  const scroller = useRef<HTMLDivElement>(null);
  const yesterday = useRef<HTMLButtonElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const popupId = useId();
  const [selected, setSelected] = useState<BillingCalendarDay | null>(null);

  useEffect(() => {
    if (!selected) return;
    function dismissOutside(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setSelected(null);
    }
    function dismissEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelected(null);
    }
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissEscape);
    };
  }, [selected]);

  const lastTap = useRef(0);

  function resetToToday(behavior: ScrollBehavior) {
    if (scroller.current && yesterday.current) {
      scroller.current.scrollTo({ left: yesterday.current.offsetLeft, behavior });
    }
  }

  useEffect(() => {
    resetToToday("instant");
  }, []);

  // Phones do not reliably fire dblclick, so count touch taps ourselves.
  function onPointerUp(event: React.PointerEvent) {
    if (event.pointerType !== "touch") return;
    const now = event.timeStamp;
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      resetToToday("smooth");
    } else {
      lastTap.current = now;
    }
  }

  return (
    <div ref={container} className="relative rounded-xl border border-slate-200 bg-white py-2 sm:py-3">
      <div
        ref={scroller}
        onDoubleClick={() => { setSelected(null); resetToToday("smooth"); }}
        onScroll={() => setSelected(null)}
        onPointerUp={onPointerUp}
        className="relative grid snap-x auto-cols-[calc(100%/10)] grid-flow-col overflow-x-auto [scrollbar-width:none] sm:auto-cols-[calc(100%/14)] lg:auto-cols-[calc(100%/21)] [&::-webkit-scrollbar]:hidden"
        style={{
          maskImage: "linear-gradient(to right, transparent, #000 7%, #000 93%, transparent)",
          WebkitMaskImage: "linear-gradient(to right, transparent, #000 7%, #000 93%, transparent)",
          touchAction: "manipulation",
        }}
      >
        {days.map((d) => {
          const episode = releases[d.date];
          const event = d.event ? EVENT_STYLE[d.event] : episode ? { dot: "bg-[#ff0000] text-white", text: "text-[#cc0000]", label: `Episode ${episode} · 5 p.m. Central` } : null;
          const isToday = d.offset === 0;
          return (
            <button
              type="button"
              key={d.date}
              aria-label={`${monthOf(d.date)} ${d.day}${event ? ` · ${event.label}` : ""}${d.payWindow ? " · Pay window" : ""}`}
              aria-expanded={selected?.date === d.date}
              aria-controls={selected?.date === d.date ? popupId : undefined}
              onClick={() => setSelected(current => current?.date === d.date ? null : d)}
              ref={d.offset === -1 ? yesterday : undefined}
              className={`flex snap-start cursor-pointer flex-col items-center gap-1 py-1 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-600 ${d.payWindow ? "bg-emerald-50" : ""} ${
                d.offset < 0 ? "opacity-40 grayscale" : ""
              }`}
              title={`${monthOf(d.date)} ${d.day}${event ? ` · ${event.label}` : ""}${episode && d.event ? ` · Episode ${episode} · 5 p.m. Central` : ""}`}
            >
              <span className={`h-3.5 text-[11px] font-bold leading-3.5 tabular-nums ${event?.text ?? ""}`}>
                {event && d.offset >= 0 ? countdown(d.offset) : ""}
              </span>
              <span className="text-[10px] leading-3 text-slate-400">{WEEKDAY[d.weekday]}</span>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                  event ? event.dot : ""
                } ${isToday ? "ring-2 ring-offset-1" : ""}`}
                style={{
                  ...(event ? {} : { color: "var(--text-primary)" }),
                  ...(isToday ? { ["--tw-ring-color" as string]: "var(--text-primary)" } : {}),
                }}
              >
                {d.day}
              </span>
              <span className="h-3 text-[10px] font-semibold uppercase leading-3 text-slate-500">
                {episode ? `E${episode}` : d.day === 1 ? monthOf(d.date) : ""}
              </span>
            </button>
          );
        })}
      </div>
      {selected && (
        <div id={popupId} role="dialog" aria-label="Calendar date details" className="absolute inset-x-0 bottom-full z-30 mb-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-slate-900">{new Date(selected.date + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
            <button type="button" aria-label="Close calendar details" onClick={() => setSelected(null)} className="-m-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><X size={16} /></button>
          </div>
          <div className="mt-2 space-y-2">
            {selected.event && <p><strong>{EVENT_STYLE[selected.event].label}.</strong> {EVENT_STYLE[selected.event].detail}</p>}
            {selected.payWindow && <p><strong>Pay window.</strong> The 1st through the 7th. Clients can pay without a late fee.</p>}
            {releases[selected.date] && <p><strong>Episode {releases[selected.date]} release.</strong> The $10K Month · 5 p.m. Central on YouTube.</p>}
            {!selected.event && !selected.payWindow && !releases[selected.date] && <p>No billing or episode release scheduled for this date.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

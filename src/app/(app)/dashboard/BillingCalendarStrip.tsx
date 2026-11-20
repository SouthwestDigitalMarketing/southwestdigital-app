"use client";

import { useEffect, useRef } from "react";
import type { BillingCalendarDay } from "@/lib/dashboard/billing-timers";

const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const EVENT_STYLE: Record<NonNullable<BillingCalendarDay["event"]>, { dot: string; label: string }> = {
  payday: { dot: "bg-emerald-600 text-white", label: "Payday" },
  reminders: { dot: "bg-blue-600 text-white", label: "Reminders go out" },
  late_fees: { dot: "bg-rose-600 text-white", label: "Late fees applied" },
};

function monthOf(date: string) {
  return MONTH[Number(date.slice(5, 7)) - 1];
}

/**
 * One swipeable row of days: 10 visible on a phone, more on wider screens.
 * Opens with yesterday at the left edge; both edges fade out.
 */
export function BillingCalendarStrip({ days }: { days: BillingCalendarDay[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const yesterday = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scroller.current && yesterday.current) {
      scroller.current.scrollLeft = yesterday.current.offsetLeft;
    }
  }, []);

  return (
    <div className="mb-2 rounded-xl border border-slate-200 bg-white py-2 sm:mb-4 sm:py-3">
      <div
        ref={scroller}
        className="relative grid snap-x auto-cols-[calc(100%/10)] grid-flow-col overflow-x-auto [scrollbar-width:none] sm:auto-cols-[calc(100%/14)] lg:auto-cols-[calc(100%/21)] [&::-webkit-scrollbar]:hidden"
        style={{
          maskImage: "linear-gradient(to right, transparent, #000 7%, #000 93%, transparent)",
          WebkitMaskImage: "linear-gradient(to right, transparent, #000 7%, #000 93%, transparent)",
        }}
      >
        {days.map((d) => {
          const event = d.event ? EVENT_STYLE[d.event] : null;
          const isToday = d.offset === 0;
          return (
            <div
              key={d.date}
              ref={d.offset === -1 ? yesterday : undefined}
              className={`flex snap-start flex-col items-center gap-1 py-1 ${d.payWindow ? "bg-emerald-50" : ""}`}
              title={`${monthOf(d.date)} ${d.day}${event ? ` · ${event.label}` : ""}`}
            >
              <span className="h-3 text-[10px] font-semibold uppercase leading-3 text-slate-500">
                {d.day === 1 ? monthOf(d.date) : ""}
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
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 px-3 text-[11px] text-slate-500">
        {Object.values(EVENT_STYLE).map((e) => (
          <span key={e.label} className="flex items-center gap-1">
            <span className={`inline-block h-2 w-2 rounded-full ${e.dot}`} />
            {e.label}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-emerald-50 ring-1 ring-slate-200" />
          Pay window
        </span>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Modal } from "@/components/Modal";
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
    dot: "bg-blue-600 text-white",
    text: "text-blue-700",
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

export function BillingLegendButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="What the calendar colors mean"
        onClick={() => setOpen(true)}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[11px] font-semibold text-slate-500 hover:text-slate-700"
      >
        ?
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} labelledBy="billing-legend-title" className="max-w-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 id="billing-legend-title" className="text-base font-semibold text-slate-900">
                Billing calendar
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              {Object.values(EVENT_STYLE).map((e) => (
                <li key={e.label} className="flex gap-3">
                  <span className={`mt-0.5 inline-block h-4 w-4 shrink-0 rounded-full ${e.dot}`} />
                  <span>
                    <span className="font-semibold text-slate-900">{e.label}.</span> {e.detail}
                  </span>
                </li>
              ))}
              <li className="flex gap-3">
                <span className="mt-0.5 inline-block h-4 w-4 shrink-0 rounded bg-emerald-50 ring-1 ring-slate-200" />
                <span>
                  <span className="font-semibold text-slate-900">Pay window.</span> The 1st through the 7th, when
                  clients can pay without a late fee.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 inline-block h-4 w-4 shrink-0 rounded-full ring-2 ring-slate-500" />
                <span>
                  <span className="font-semibold text-slate-900">Today.</span> The number above a colored day is how
                  many days until it.
                </span>
              </li>
            </ul>
            <p className="mt-4 text-xs text-slate-400">Swipe the row to see past and future days.</p>
          </div>
        </Modal>
      )}
    </>
  );
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
    <div className="rounded-xl border border-slate-200 bg-white py-2 sm:py-3">
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
                {d.day === 1 ? monthOf(d.date) : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

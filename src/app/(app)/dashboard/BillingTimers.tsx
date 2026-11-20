import { CalendarClock } from "lucide-react";
import type { BillingCalendarDay, BillingTimer } from "@/lib/dashboard/billing-timers";
import { BillingCalendarStrip } from "./BillingCalendarStrip";

const SHORT_LABEL: Record<BillingTimer["key"], string> = {
  payday: "Payday",
  reminders: "Reminders",
  late_fees: "Late fees",
};

const NOTE: Record<BillingTimer["key"], string> = {
  payday: "Clients pay on the 1st",
  reminders: "3 days before month end",
  late_fees: "Unpaid after 7 days",
};

function fmtDate(key: string) {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function fmtDays(days: number) {
  if (days === 0) return "Today";
  return `${days} day${days === 1 ? "" : "s"}`;
}

function TimerCard({ timer }: { timer: BillingTimer }) {
  const urgent = timer.running && timer.days <= 3;
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-3 sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
        <span className="sm:hidden">{SHORT_LABEL[timer.key]}</span>
        <span className="hidden sm:inline">{timer.label}</span>
      </p>
      {timer.running ? (
        <p
          className={`mt-1 text-xl font-semibold tabular-nums sm:mt-2 sm:text-3xl ${urgent ? "text-amber-700" : ""}`}
          style={urgent ? undefined : { color: "var(--text-primary)" }}
        >
          {fmtDays(timer.days)}
        </p>
      ) : (
        <p className="mt-1 text-sm font-semibold text-slate-500 sm:mt-2 sm:text-lg">Starts in {fmtDays(timer.days)}</p>
      )}
      <p className="mt-0.5 text-xs text-slate-500">{fmtDate(timer.date)}</p>
      <p className="mt-0.5 hidden text-xs text-slate-400 sm:block">{NOTE[timer.key]}</p>
    </div>
  );
}

export function BillingTimers({ timers, days }: { timers: BillingTimer[]; days: BillingCalendarDay[] }) {
  return (
    <section className="mt-5 sm:mt-6">
      <div className="mb-2 flex items-center gap-1.5 text-slate-500 sm:mb-3">
        <span className="shrink-0">
          <CalendarClock size={14} />
        </span>
        <h2 className="text-xs font-semibold uppercase tracking-wide">Billing calendar</h2>
      </div>
      <BillingCalendarStrip days={days} />
      <div className="grid min-w-0 grid-cols-3 gap-2 sm:gap-5">
        {timers.map((timer) => (
          <TimerCard key={timer.key} timer={timer} />
        ))}
      </div>
    </section>
  );
}

import { releaseEpisodes } from "@/lib/showrunner/release-schedule";
import { CalendarClock } from "lucide-react";
import type { BillingCalendarDay } from "@/lib/dashboard/billing-timers";
import { BillingCalendarStrip, BillingLegendButton } from "./BillingCalendarStrip";

export function BillingTimers({ days }: { days: BillingCalendarDay[] }) {
  return (
    <section className="mt-5 sm:mt-6">
      <div className="mb-2 flex items-center gap-1.5 text-slate-500 sm:mb-3">
        <span className="shrink-0">
          <CalendarClock size={14} />
        </span>
        <h2 className="text-xs font-semibold uppercase tracking-wide">Billing calendar</h2>
        <BillingLegendButton />
      </div>
      <BillingCalendarStrip days={days} releases={releaseEpisodes} />
      <p className="mt-2 text-xs text-slate-500">E1–E6: Showrunner releases · Sundays at 5 p.m. Central.</p>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { BillingCalendarStrip } from "../dashboard/BillingCalendarStrip";
import { billingCalendarDays } from "@/lib/dashboard/billing-timers";
import { schedule, releaseEpisodes } from "@/lib/showrunner/release-schedule";

function dateKey(now: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: schedule.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** The swipe calendar alone, release Sundays and billing dates marked (Tom, 2026-11-24: no card around it). */
export function ReleaseCalendar({ initialNow }: { initialNow: string }) {
  const [now, setNow] = useState(() => new Date(initialNow));
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const today = dateKey(now);
  const days = billingCalendarDays(today, 14, Math.max(60, Math.ceil((Date.parse("2027-01-04") - Date.parse(today)) / 86400000)));
  return <BillingCalendarStrip days={days} releases={releaseEpisodes} />;
}

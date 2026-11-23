"use client";

import { useEffect, useState } from "react";
import { BillingCalendarStrip } from "../dashboard/BillingCalendarStrip";
import { billingCalendarDays } from "@/lib/dashboard/billing-timers";
import { schedule, releaseCountdown, releaseEpisodes } from "@/lib/showrunner/release-schedule";

function dateKey(now: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: schedule.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function ReleaseCalendar({ initialNow }: { initialNow: string }) {
  const [now, setNow] = useState(() => new Date(initialNow));
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const { next, label } = releaseCountdown(now);
  const today = dateKey(now);
  const seasonWeek = Math.max(1, Math.min(6, Math.floor((Date.parse(today) - Date.parse(schedule.startsOn)) / (7 * 86400000)) + 1));
  const days = billingCalendarDays(today, 14, Math.max(60, Math.ceil((Date.parse("2027-01-04") - Date.parse(today)) / 86400000))).map(d => ({ ...d, event: null, payWindow: false }));
  return (
    <section className="mb-7 rounded-2xl border border-slate-200 bg-white px-3 py-4 sm:px-4 sm:py-6" aria-label="Season release calendar">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{schedule.season} · Six-episode season</p>
      <h2 className="mt-2 text-2xl font-bold text-slate-900" aria-live="polite">{label}</h2>
      <p className="mt-1 text-sm text-slate-500">{next ? `${new Date(next.at).toLocaleDateString("en-US", { timeZone: schedule.timezone, weekday: "long", month: "short", day: "numeric", year: "numeric" })} · 5 p.m. Central` : "Nov 29 – Jan 3 · Sundays at 5 p.m. Central"}</p>
      <ol className="my-5 grid grid-cols-6 gap-2" aria-label="Six planned releases">
        {schedule.releases.map(r => <li key={r.episode} className={`rounded-lg border py-2 text-center ${r.episode === next?.episode ? "border-indigo-600 bg-indigo-50 text-indigo-800" : "border-slate-200 text-slate-500"}`} aria-current={r.episode === next?.episode ? "step" : undefined}>
          <span className="block text-xs font-semibold">Ep {r.episode}</span>
          <span className="mt-1 block text-[10px] sm:text-xs">{new Date(r.at).toLocaleDateString("en-US", { timeZone: schedule.timezone, month: "short", day: "numeric" })}</span>
        </li>)}
      </ol>
      <p className="mb-2 text-xs text-slate-500">{today <= "2027-01-03" ? `Week ${seasonWeek} of 6 · ` : ""}Swipe for release dates. Purple marks an episode release.</p>
      <BillingCalendarStrip days={days} releases={releaseEpisodes} />
    </section>
  );
}

import { firmDateKey, firmInstant } from "@/lib/operations/schedule";

export const PERIODS = {
  today: "Today",
  week: "This week",
  month: "This month",
} as const;
export function activityPeriod(range: string, now = new Date()) {
  const day = firmDateKey(now);
  const date = new Date(`${day}T12:00:00Z`);
  if (range === "week")
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  if (range === "month") date.setUTCDate(1);
  const start = firmInstant(date.toISOString().slice(0, 10), 0);
  const previous = new Date(date);
  if (range === "month") previous.setUTCMonth(previous.getUTCMonth() - 1);
  else previous.setUTCDate(previous.getUTCDate() - (range === "week" ? 7 : 1));
  return {
    start,
    end: now,
    previousStart: firmInstant(previous.toISOString().slice(0, 10), 0),
    previousEnd: start,
  };
}

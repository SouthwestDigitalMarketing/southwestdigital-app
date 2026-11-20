import { describe, expect, it } from "vitest";
import { billingCalendarDays } from "./billing-timers";

describe("billingCalendarDays", () => {
  it("marks payday, reminder day, late-fee day and the pay window", () => {
    const days = billingCalendarDays("2026-11-20", 1, 20);
    expect(days[0]).toMatchObject({ date: "2026-11-19", offset: -1 });
    expect(days[1]).toMatchObject({ date: "2026-11-20", offset: 0, weekday: 5, event: null });
    const at = (date: string) => days.find((d) => d.date === date);
    expect(at("2026-11-27")?.event).toBe("reminders");
    expect(at("2026-12-01")).toMatchObject({ event: "payday", payWindow: true });
    expect(at("2026-12-07")).toMatchObject({ event: null, payWindow: true });
    expect(at("2026-12-08")).toMatchObject({ event: "late_fees", payWindow: false });
    expect(days).toHaveLength(22);
  });

  it("puts February's reminder on the 25th", () => {
    expect(billingCalendarDays("2027-02-20", 0, 10).find((d) => d.event === "reminders")?.date).toBe("2027-02-25");
  });
});

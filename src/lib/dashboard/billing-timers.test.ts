import { describe, expect, it } from "vitest";
import { billingTimers } from "./billing-timers";

function byKey(today: string) {
  return Object.fromEntries(billingTimers(today).map((t) => [t.key, t]));
}

describe("billingTimers", () => {
  it("mid-November: payday Dec 1, reminders Nov 27, late fees not started", () => {
    const t = byKey("2026-11-20");
    expect(t.payday).toMatchObject({ days: 11, date: "2026-12-01" });
    expect(t.reminders).toMatchObject({ days: 7, date: "2026-11-27" });
    expect(t.late_fees).toMatchObject({ running: false, days: 11, date: "2026-12-01" });
  });

  it("on the 1st: payday is today and the late-fee countdown runs to the 8th", () => {
    const t = byKey("2026-12-01");
    expect(t.payday).toMatchObject({ days: 0, date: "2026-12-01" });
    expect(t.late_fees).toMatchObject({ running: true, days: 7, date: "2026-12-08" });
    expect(t.reminders).toMatchObject({ date: "2026-12-28" });
  });

  it("on the 7th the late fee is 1 day away; on the 8th the window has closed", () => {
    expect(byKey("2026-12-07").late_fees).toMatchObject({ running: true, days: 1, date: "2026-12-08" });
    expect(byKey("2026-12-08").late_fees).toMatchObject({ running: false, date: "2027-01-01" });
  });

  it("reminder day itself is today; the day after rolls to next month", () => {
    expect(byKey("2026-11-27").reminders).toMatchObject({ days: 0, date: "2026-11-27" });
    expect(byKey("2026-11-28").reminders).toMatchObject({ date: "2026-12-28" });
  });

  it("handles February and year end", () => {
    expect(byKey("2027-02-10").reminders.date).toBe("2027-02-25");
    expect(byKey("2028-02-10").reminders.date).toBe("2028-02-26");
    expect(byKey("2026-12-30").payday).toMatchObject({ days: 2, date: "2027-01-01" });
    expect(byKey("2026-12-30").reminders.date).toBe("2027-01-28");
  });
});

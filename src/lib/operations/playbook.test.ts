import { describe, expect, it } from "vitest";
import { PLAYBOOK, dutiesDueOn, firmDate, upcomingThisMonth } from "./playbook";

// 17:00 UTC is late morning in Chicago, so the firm-local date matches the UTC date.
const at = (iso: string) => new Date(`${iso}T17:00:00Z`);
const ids = (duties: { id: string }[]) => duties.map((d) => d.id);

describe("operations playbook schedule", () => {
  it("reads the date in the firm's time zone", () => {
    // 03:00 UTC on the 19th is still the evening of the 18th in Chicago.
    expect(firmDate(new Date("2026-11-19T03:00:00Z"))).toMatchObject({ day: 18, weekday: 3 });
  });

  it("puts every daily duty and only that weekday's weekly duty on a weekday", () => {
    const due = ids(dutiesDueOn(at("2026-11-18"))); // Wednesday
    expect(due).toContain("daily-bank-feeds");
    expect(due).toContain("weekly-owed-nudge");
    expect(due).not.toContain("weekly-status-note");
  });

  it("has nothing due on a weekend unless a monthly date falls there", () => {
    expect(dutiesDueOn(at("2026-11-22"))).toEqual([]); // Sunday the 22nd
    expect(ids(dutiesDueOn(at("2026-11-01")))).toEqual([
      "monthly-invoice",
      "monthly-statement-reminder",
    ]); // Sunday the 1st
  });

  it("lists the rest of the month's monthly duties in date order", () => {
    expect(ids(upcomingThisMonth(at("2026-11-18")))).toEqual([
      "monthly-close",
      "monthly-post-close-email",
      "monthly-check-in",
    ]);
  });

  it("keeps duty ids unique", () => {
    expect(new Set(ids(PLAYBOOK)).size).toBe(PLAYBOOK.length);
  });
});

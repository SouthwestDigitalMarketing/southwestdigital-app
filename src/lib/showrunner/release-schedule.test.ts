import { describe, expect, it } from "vitest";
import { releaseCountdown, schedule } from "./release-schedule";

describe("six-episode release schedule", () => {
  it("uses six consecutive Sundays at 5 p.m. Chicago, across year end", () => {
    expect(schedule.releases).toHaveLength(6);
    for (const [i, release] of schedule.releases.entries()) {
      const date = new Date(release.at);
      expect(date.getUTCDay()).toBe(0);
      expect(new Intl.DateTimeFormat("en-US", { timeZone: schedule.timezone, hour: "numeric", hour12: false }).format(date)).toBe("17");
      if (i) expect(date.getTime() - Date.parse(schedule.releases[i - 1].at)).toBe(7 * 86400000);
    }
    expect(schedule.releases[5].date).toBe("2027-01-03");
  });
  it("counts down and advances only after the scheduled time", () => {
    expect(releaseCountdown(new Date("2026-11-23T19:00:00Z")).label).toBe("6 days until Episode 1");
    expect(releaseCountdown(new Date("2026-11-29T22:30:00Z")).label).toBe("1 hour until Episode 1");
    expect(releaseCountdown(new Date("2026-11-29T23:00:00Z")).label).toBe("Episode 1 is due now");
    expect(releaseCountdown(new Date("2026-11-29T23:00:01Z")).next?.episode).toBe(2);
    expect(releaseCountdown(new Date("2027-01-04T00:00:00Z")).next).toBeNull();
  });
});

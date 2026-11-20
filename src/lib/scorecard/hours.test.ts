import { describe, expect, it } from "vitest";
import { BUSINESS_HOURS, businessSecondsBetween, clockSecondsBetween } from "./hours";

const at = (iso: string) => new Date(iso);
const H = 3600;

describe("BUSINESS_HOURS", () => {
  it("is Monday to Friday, 8 to 5, Central", () => {
    expect(BUSINESS_HOURS.timeZone).toBe("America/Chicago");
    expect(BUSINESS_HOURS.label).toBe("Mon–Fri 8am–5pm Central");
  });
});

describe("businessSecondsBetween", () => {
  it("counts a span inside one business day exactly", () => {
    // Thu 2026-11-19, 9:00 to 9:42:30 CST (UTC-6).
    expect(businessSecondsBetween(at("2026-11-19T15:00:00Z"), at("2026-11-19T15:42:30Z"))).toBe(42 * 60 + 30);
  });

  it("is 0 when end is before or equal to start", () => {
    expect(businessSecondsBetween(at("2026-11-19T16:00:00Z"), at("2026-11-19T15:00:00Z"))).toBe(0);
    expect(businessSecondsBetween(at("2026-11-19T16:00:00Z"), at("2026-11-19T16:00:00Z"))).toBe(0);
  });

  it("is 0 for invalid dates", () => {
    expect(businessSecondsBetween(new Date("x"), at("2026-11-19T16:00:00Z"))).toBe(0);
  });

  it("clips a start before opening and an end after closing", () => {
    // 6:00 to 19:00 CST on a Thursday = the whole 9-hour day.
    expect(businessSecondsBetween(at("2026-11-19T12:00:00Z"), at("2026-11-20T01:00:00Z"))).toBe(9 * H);
  });

  it("is 0 for a span entirely outside hours", () => {
    // Thu 17:30 to 22:00 CST, and the night to Fri 7:59.
    expect(businessSecondsBetween(at("2026-11-19T23:30:00Z"), at("2026-11-20T04:00:00Z"))).toBe(0);
    expect(businessSecondsBetween(at("2026-11-19T23:30:00Z"), at("2026-11-20T13:59:00Z"))).toBe(0);
  });

  it("skips the weekend: Friday 5:30pm to Monday 8:10am is 10 minutes", () => {
    expect(businessSecondsBetween(at("2026-11-20T23:30:00Z"), at("2026-11-23T14:10:00Z"))).toBe(10 * 60);
  });

  it("is 0 for a span inside a weekend", () => {
    expect(businessSecondsBetween(at("2026-11-21T15:00:00Z"), at("2026-11-22T20:00:00Z"))).toBe(0);
  });

  it("adds whole days in between", () => {
    // Mon 16:00 CST to Thu 9:00 CST: 1h + Tue 9h + Wed 9h + 1h.
    expect(businessSecondsBetween(at("2026-11-16T22:00:00Z"), at("2026-11-19T15:00:00Z"))).toBe(20 * H);
    // Two full weeks, Monday 8:00 to Monday 8:00: 10 business days.
    expect(businessSecondsBetween(at("2026-11-02T14:00:00Z"), at("2026-11-16T14:00:00Z"))).toBe(90 * H);
  });

  it("uses the firm day, not the UTC day", () => {
    // Thu 2026-11-19 22:00 CST is Fri 04:00 UTC; to Fri 9:00 CST = 1 hour.
    expect(businessSecondsBetween(at("2026-11-20T04:00:00Z"), at("2026-11-20T15:00:00Z"))).toBe(H);
  });

  it("follows daylight saving: CDT hours are UTC-5", () => {
    // Wed 2026-07-01 8:00 to 17:00 CDT = 13:00Z to 22:00Z.
    expect(businessSecondsBetween(at("2026-07-01T13:00:00Z"), at("2026-07-01T22:00:00Z"))).toBe(9 * H);
    // 7:00 CDT (12:00Z) is still before opening.
    expect(businessSecondsBetween(at("2026-07-01T12:00:00Z"), at("2026-07-01T14:00:00Z"))).toBe(H);
  });

  it("spans the spring-forward weekend (2026-03-08)", () => {
    // Fri 2026-03-06 16:00 CST (22:00Z) to Mon 2026-03-09 9:00 CDT (14:00Z): 1h + 1h.
    expect(businessSecondsBetween(at("2026-03-06T22:00:00Z"), at("2026-03-09T14:00:00Z"))).toBe(2 * H);
    // Clock time is one hour short of the wall-clock difference.
    expect(clockSecondsBetween(at("2026-03-06T22:00:00Z"), at("2026-03-09T14:00:00Z"))).toBe(64 * H);
  });

  it("spans the fall-back weekend (2026-11-01)", () => {
    // Fri 2026-10-30 16:00 CDT (21:00Z) to Mon 2026-11-02 9:00 CST (15:00Z): 1h + 1h.
    expect(businessSecondsBetween(at("2026-10-30T21:00:00Z"), at("2026-11-02T15:00:00Z"))).toBe(2 * H);
    // Monday 8:00 CST is 14:00Z, not 13:00Z.
    expect(businessSecondsBetween(at("2026-11-02T13:00:00Z"), at("2026-11-02T14:00:00Z"))).toBe(0);
  });

  it("covers a whole week across a change of offset", () => {
    // Mon 2026-03-02 8:00 CST to Mon 2026-03-09 8:00 CDT: 5 days.
    expect(businessSecondsBetween(at("2026-03-02T14:00:00Z"), at("2026-03-09T13:00:00Z"))).toBe(45 * H);
  });
});

describe("clockSecondsBetween", () => {
  it("never goes negative", () => {
    expect(clockSecondsBetween(at("2026-11-19T16:00:00Z"), at("2026-11-19T15:00:00Z"))).toBe(0);
    expect(clockSecondsBetween(at("2026-11-19T15:00:00Z"), at("2026-11-19T15:00:01.900Z"))).toBe(1);
  });
});

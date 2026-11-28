import { describe, expect, it } from "vitest";
import { STAFF_TIME_ZONE, staffDateKey } from "./staffDates";

describe("staffDateKey", () => {
  it("defaults to the firm Chicago day, not the UTC slice", () => {
    expect(STAFF_TIME_ZONE).toBe("America/Chicago");
    // 02:00Z Sep 1 is still Aug 31 in Chicago; a UTC slice would read Sep 1.
    expect(staffDateKey(new Date("2026-09-01T02:00:00Z"))).toBe("2026-08-31");
    expect(staffDateKey(new Date("2026-09-01T12:00:00Z"))).toBe("2026-09-01");
  });

  it("accepts an explicit staff zone", () => {
    expect(staffDateKey(new Date("2026-09-01T02:00:00Z"), "UTC")).toBe("2026-09-01");
  });
});

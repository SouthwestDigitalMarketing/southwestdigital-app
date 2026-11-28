import { describe, expect, it } from "vitest";
import { expiryBadgeForQuote } from "./expiryBadge";

const NOW = new Date("2026-11-28T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

describe("expiryBadgeForQuote", () => {
  it("returns null when frozen, even when expired", () => {
    expect(expiryBadgeForQuote(new Date(NOW.getTime() - DAY_MS), true, NOW)).toBeNull();
  });
  it("returns null without an expiry date", () => {
    expect(expiryBadgeForQuote(null, false, NOW)).toBeNull();
  });
  it("labels a past expiry as Expired for unaccepted quotes", () => {
    expect(expiryBadgeForQuote(new Date(NOW.getTime() - 1000), false, NOW)).toEqual({
      label: "Expired",
      expired: true,
    });
  });
  it("counts down the last five days", () => {
    expect(expiryBadgeForQuote(new Date(NOW.getTime() + 1 * DAY_MS), false, NOW)).toEqual({
      label: "Expires in 1 day",
      expired: false,
    });
    expect(expiryBadgeForQuote(new Date(NOW.getTime() + 5 * DAY_MS), false, NOW)).toEqual({
      label: "Expires in 5 days",
      expired: false,
    });
  });
  it("rounds a partial day up", () => {
    expect(expiryBadgeForQuote(new Date(NOW.getTime() + 12 * 60 * 60 * 1000), false, NOW)).toEqual({
      label: "Expires in 1 day",
      expired: false,
    });
  });
  it("stays quiet beyond five days", () => {
    expect(expiryBadgeForQuote(new Date(NOW.getTime() + 6 * DAY_MS), false, NOW)).toBeNull();
  });
});

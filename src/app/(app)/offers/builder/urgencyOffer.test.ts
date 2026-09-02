import { describe, expect, it } from "vitest";
import {
  DEFAULT_URGENCY_OFFER,
  getUrgencyExpiresAt,
  getUrgencyOfferDisplay,
  normalizeUrgencyOffer,
} from "./urgencyOffer";

describe("normalizeUrgencyOffer", () => {
  it("returns defaults for missing values", () => {
    expect(normalizeUrgencyOffer(undefined)).toEqual(DEFAULT_URGENCY_OFFER);
  });

  it("keeps a configured limited-time bonus", () => {
    expect(
      normalizeUrgencyOffer({
        enabled: true,
        deadlineMode: "date",
        deadlineDate: "2026-09-15",
        kind: "bonus",
        title: "First monthly close included",
        details: "We will complete the first monthly close at no extra charge.",
      }),
    ).toMatchObject({
      enabled: true,
      deadlineMode: "date",
      deadlineDate: "2026-09-15",
      kind: "bonus",
      title: "First monthly close included",
    });
  });
});

describe("getUrgencyOfferDisplay", () => {
  it("is inactive when the offer is turned off", () => {
    expect(getUrgencyOfferDisplay(DEFAULT_URGENCY_OFFER).active).toBe(false);
  });

  it("uses a calendar deadline and hides the offer after it expires", () => {
    const config = normalizeUrgencyOffer({
      enabled: true,
      deadlineMode: "date",
      deadlineDate: "2026-09-10",
      kind: "percent-off",
      percent: 15,
    });
    const active = getUrgencyOfferDisplay(config, new Date(2026, 8, 8, 12));
    expect(active.active).toBe(true);
    expect(active.headline).toContain("15%");
    expect(active.remainingLabel).toBe("3 days left");

    const expired = getUrgencyOfferDisplay(config, new Date(2026, 8, 11, 9));
    expect(expired.active).toBe(false);
    expect(expired.expired).toBe(true);
  });

  it("starts a relative window from the send date", () => {
    const config = normalizeUrgencyOffer({
      enabled: true,
      deadlineMode: "relative",
      durationDays: 14,
      kind: "onboarding-waiver",
    });
    const expiresAt = getUrgencyExpiresAt(config, new Date(2026, 8, 1), new Date(2026, 8, 1));
    expect(expiresAt?.getDate()).toBe(15);
  });
});

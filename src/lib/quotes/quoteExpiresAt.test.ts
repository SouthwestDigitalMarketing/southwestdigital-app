import { describe, expect, it } from "vitest";
import {
  expiresAtForQuotePublish,
  quoteExpiresAtForPublish,
  snapshotUrgencyFromSnapshot,
} from "./quoteExpiresAt";

const publishedAt = new Date(2026, 8, 1);

describe("quoteExpiresAtForPublish", () => {
  it("uses catalog offer expiresAt when present", () => {
    const catalogDeadline = new Date("2026-09-15T23:59:59.999");
    expect(quoteExpiresAtForPublish({
      publishedAt,
      catalogOfferExpiresAt: catalogDeadline,
      snapshotUrgency: {
        enabled: true,
        deadlineMode: "relative",
        durationDays: 3,
      },
    })).toBe(catalogDeadline);
  });

  it("falls back to snapshot urgency deadline", () => {
    const expiresAt = quoteExpiresAtForPublish({
      publishedAt,
      catalogOfferExpiresAt: null,
      snapshotUrgency: {
        enabled: true,
        deadlineMode: "relative",
        durationDays: 14,
      },
    });
    expect(expiresAt).toBeInstanceOf(Date);
    expect(expiresAt?.getTime()).toBeGreaterThan(publishedAt.getTime());
  });

  it("returns null when no catalog offer and urgency is disabled", () => {
    expect(quoteExpiresAtForPublish({
      publishedAt,
      catalogOfferExpiresAt: null,
      snapshotUrgency: { enabled: false, durationDays: 14 },
    })).toBeNull();
  });
});

describe("expiresAtForQuotePublish", () => {
  it("writes catalog deadline onto the publish payload", () => {
    const expiresAt = expiresAtForQuotePublish({
      publishedAt,
      discounts: [{
        kind: "percent-off",
        percent: 10,
        amount: 0,
        title: "Launch",
        details: "",
        activationMode: "immediate",
        activationDelayDays: 0,
        deadlineMode: "relative",
        durationDays: 10,
        deadlineDate: null,
        presentedAt: publishedAt,
      }],
      snapshot: { assessment: { urgencyOffer: { enabled: true, durationDays: 3 } } },
    });
    expect(expiresAt).toBeInstanceOf(Date);
  });

  it("reads urgencyOffer from the assessment snapshot", () => {
    expect(snapshotUrgencyFromSnapshot({
      assessment: { urgencyOffer: { enabled: true, durationDays: 7 } },
    })).toEqual({ enabled: true, durationDays: 7 });
  });
});

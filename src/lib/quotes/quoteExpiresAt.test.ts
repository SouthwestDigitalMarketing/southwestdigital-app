import { describe, expect, it } from "vitest";
import {
  expiresAtForQuotePublish,
  quoteExpiresAtForPublish,
  resolveQuoteExpiresAtForWrite,
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

describe("resolveQuoteExpiresAtForWrite", () => {
  const at = new Date("2026-09-01T12:00:00Z");

  it("falls back to sentAt + 30 days when there is no promotion deadline", () => {
    expect(
      resolveQuoteExpiresAtForWrite({ at, snapshot: {}, promoDeadline: null }).toISOString(),
    ).toBe("2026-10-01T12:00:00.000Z");
  });

  it("keeps the earlier promotion deadline", () => {
    const promo = new Date("2026-09-10T00:00:00Z");
    expect(resolveQuoteExpiresAtForWrite({ at, snapshot: {}, promoDeadline: promo })).toBe(promo);
  });

  it("ignores a later promotion deadline in favour of the default", () => {
    const promo = new Date("2027-01-01T00:00:00Z");
    expect(
      resolveQuoteExpiresAtForWrite({ at, snapshot: {}, promoDeadline: promo }).toISOString(),
    ).toBe("2026-10-01T12:00:00.000Z");
  });

  it("honours an edited per-proposal validity window", () => {
    expect(
      resolveQuoteExpiresAtForWrite({
        at,
        snapshot: { proposalValidityDays: 7 },
        promoDeadline: null,
      }).toISOString(),
    ).toBe("2026-09-08T12:00:00.000Z");
  });
});

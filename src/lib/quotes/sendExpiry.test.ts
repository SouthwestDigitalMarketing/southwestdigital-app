import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { brandDiscount: { findMany: mocks.findMany } } }));

import { promoDeadlineFromSnapshot } from "./proposalValidity";
import { resolveSendExpiry } from "./sendExpiry";

const at = new Date("2026-09-20T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function discountRow(deadlineDate: string) {
  return {
    kind: "percent-off",
    percent: 10,
    amount: 0,
    title: "Launch",
    details: "",
    activationMode: "immediate",
    activationDelayDays: 0,
    deadlineMode: "date",
    durationDays: 10,
    deadlineDate,
    presentedAt: null,
  };
}

function deadlineKey(daysFromNow: number) {
  return new Date(Date.now() + daysFromNow * DAY_MS).toISOString().slice(0, 10);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findMany.mockResolvedValue([]);
});

describe("resolveSendExpiry", () => {
  it("stamps sentAt + 30 days and clears the promo stamp when no promotion is live", async () => {
    const send = await resolveSendExpiry({
      brandId: "brand",
      quoteId: "q1",
      quote: { status: "sent", engagement: null },
      snapshot: {},
      publishedAt: new Date("2026-09-01T12:00:00Z"),
      at,
    });
    expect(send.expiresAt.toISOString()).toBe("2026-10-20T12:00:00.000Z");
    expect(promoDeadlineFromSnapshot(send.snapshot)).toBeNull();
  });

  it("ignores a stale future promo stamp (deleted promo stops capping)", async () => {
    const send = await resolveSendExpiry({
      brandId: "brand",
      quoteId: "q1",
      quote: { status: "sent", engagement: null },
      snapshot: { proposalPromoExpiresAt: "2027-06-01T00:00:00.000Z" },
      publishedAt: new Date("2026-09-01T12:00:00Z"),
      at,
    });
    expect(send.expiresAt.toISOString()).toBe("2026-10-20T12:00:00.000Z");
    expect(promoDeadlineFromSnapshot(send.snapshot)).toBeNull();
  });

  it("revives an expired quote: a stale past stamp never caps the re-send", async () => {
    const send = await resolveSendExpiry({
      brandId: "brand",
      quoteId: "q1",
      quote: { status: "sent", engagement: null },
      snapshot: { proposalPromoExpiresAt: "2026-08-01T00:00:00.000Z" },
      publishedAt: new Date("2026-07-01T12:00:00Z"),
      at,
    });
    expect(send.expiresAt.getTime()).toBeGreaterThan(at.getTime());
    expect(send.expiresAt.toISOString()).toBe("2026-10-20T12:00:00.000Z");
  });

  it("caps at a live earlier promo deadline and restamps it", async () => {
    // Live promos are evaluated against the real now, so the send time must
    // be live too: a fixed past `at` would postdate every active deadline.
    const liveAt = new Date();
    mocks.findMany.mockResolvedValue([discountRow(deadlineKey(5))]);
    const send = await resolveSendExpiry({
      brandId: "brand",
      quoteId: "q1",
      quote: { status: "sent", engagement: null },
      snapshot: {},
      publishedAt: new Date(liveAt.getTime() - 20 * DAY_MS),
      at: liveAt,
    });
    const restamped = promoDeadlineFromSnapshot(send.snapshot);
    expect(restamped).toBeInstanceOf(Date);
    expect(send.expiresAt.getTime()).toBe(restamped!.getTime());
    expect(send.expiresAt.getTime()).toBeLessThan(liveAt.getTime() + 30 * DAY_MS);
  });

  it("honours an edited per-proposal validity window", async () => {
    const send = await resolveSendExpiry({
      brandId: "brand",
      quoteId: "q1",
      quote: { status: "sent", engagement: null },
      snapshot: { proposalValidityDays: 7 },
      publishedAt: new Date("2026-09-01T12:00:00Z"),
      at,
    });
    expect(send.expiresAt.toISOString()).toBe("2026-09-27T12:00:00.000Z");
  });

  it("refuses a frozen quote without reading discounts", async () => {
    await expect(
      resolveSendExpiry({
        brandId: "brand",
        quoteId: "q1",
        quote: { status: "accepted", engagement: null },
        snapshot: {},
        publishedAt: null,
        at,
      }),
    ).rejects.toThrow("frozen");
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});

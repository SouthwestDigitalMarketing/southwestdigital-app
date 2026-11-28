import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROPOSAL_VALIDITY_DAYS,
  defaultProposalExpiryAt,
  expiredPublicNoticeKind,
  minExpiresAt,
  promoDeadlineFromSnapshot,
  proposalValidityDaysFromSnapshot,
  replacedByQuoteIdFromSnapshot,
  replacesQuoteIdFromSnapshot,
  snapshotWithPromoStamp,
  supersedeReplacedQuote,
} from "./proposalValidity";

describe("proposalValidityDaysFromSnapshot", () => {
  it("defaults to 30 when the snapshot has no validity", () => {
    expect(proposalValidityDaysFromSnapshot(null)).toBe(DEFAULT_PROPOSAL_VALIDITY_DAYS);
    expect(proposalValidityDaysFromSnapshot({})).toBe(DEFAULT_PROPOSAL_VALIDITY_DAYS);
    expect(proposalValidityDaysFromSnapshot({ proposalValidityDays: "abc" })).toBe(
      DEFAULT_PROPOSAL_VALIDITY_DAYS,
    );
  });

  it("honours an edited per-proposal value and clamps the range", () => {
    expect(proposalValidityDaysFromSnapshot({ proposalValidityDays: 14 })).toBe(14);
    expect(proposalValidityDaysFromSnapshot({ proposalValidityDays: "45" })).toBe(45);
    expect(proposalValidityDaysFromSnapshot({ proposalValidityDays: 0 })).toBe(
      DEFAULT_PROPOSAL_VALIDITY_DAYS,
    );
    expect(proposalValidityDaysFromSnapshot({ proposalValidityDays: 400 })).toBe(365);
  });
});

describe("defaultProposalExpiryAt", () => {
  it("adds the default 30 days", () => {
    const from = new Date("2026-09-01T12:00:00Z");
    expect(defaultProposalExpiryAt(from, {}).toISOString()).toBe("2026-10-01T12:00:00.000Z");
  });

  it("adds an edited validity window", () => {
    const from = new Date("2026-09-01T12:00:00Z");
    expect(defaultProposalExpiryAt(from, { proposalValidityDays: 7 }).toISOString()).toBe(
      "2026-09-08T12:00:00.000Z",
    );
  });
});

describe("minExpiresAt", () => {
  it("keeps the earlier promotion deadline over the default", () => {
    const promo = new Date("2026-09-10T00:00:00Z");
    const fallback = new Date("2026-10-01T00:00:00Z");
    expect(minExpiresAt(fallback, promo)).toBe(promo);
    expect(minExpiresAt(fallback, null)).toBe(fallback);
    expect(minExpiresAt(null, null)).toBeNull();
  });
});

describe("promo stamp round-trip", () => {
  it("persists the promotion deadline in the snapshot", () => {
    const promo = new Date("2026-09-10T00:00:00Z");
    const stamped = snapshotWithPromoStamp({ kind: "x" }, promo);
    expect(promoDeadlineFromSnapshot(stamped)?.toISOString()).toBe("2026-09-10T00:00:00.000Z");
    expect(promoDeadlineFromSnapshot(snapshotWithPromoStamp({}, null))).toBeNull();
    expect(promoDeadlineFromSnapshot({})).toBeNull();
    expect(promoDeadlineFromSnapshot({ proposalPromoExpiresAt: "not-a-date" })).toBeNull();
  });
});

describe("supersedeReplacedQuote", () => {
  function fakeTx(old: unknown) {
    const updates: unknown[] = [];
    const tx = {
      quote: {
        findFirst: async () => old,
        update: async (args: unknown) => {
          updates.push(args);
          return args;
        },
      },
    };
    return { tx, updates };
  }

  it("expires the old quote and stamps replacedByQuoteId, sending nothing", async () => {
    const { tx, updates } = fakeTx({ id: "old", status: "sent", snapshotJson: { a: 1 } });
    const result = await supersedeReplacedQuote(tx as never, "brand", {
      oldQuoteId: "old",
      newQuoteId: "new",
      now: new Date("2026-09-01T00:00:00Z"),
    });
    expect(result).toBe("expired");
    expect(updates).toHaveLength(1);
    const data = (updates[0] as { data: Record<string, unknown> }).data;
    expect(data.expiresAt).toEqual(new Date("2026-09-01T00:00:00Z"));
    expect((data.snapshotJson as Record<string, unknown>).replacedByQuoteId).toBe("new");
    expect((data.snapshotJson as Record<string, unknown>).a).toBe(1);
  });

  it("never touches a frozen old quote", async () => {
    const { tx, updates } = fakeTx({ id: "old", status: "accepted" });
    await expect(
      supersedeReplacedQuote(tx as never, "brand", { oldQuoteId: "old", newQuoteId: "new" }),
    ).resolves.toBe("skipped-frozen");
    expect(updates).toHaveLength(0);
  });

  it("skips a missing old quote", async () => {
    const { tx, updates } = fakeTx(null);
    await expect(
      supersedeReplacedQuote(tx as never, "brand", { oldQuoteId: "old", newQuoteId: "new" }),
    ).resolves.toBe("skipped-missing");
    expect(updates).toHaveLength(0);
  });
});

describe("replace snapshot links", () => {
  it("reads replacesQuoteId and replacedByQuoteId", () => {
    expect(replacesQuoteIdFromSnapshot({ replacesQuoteId: "old-1" })).toBe("old-1");
    expect(replacesQuoteIdFromSnapshot({})).toBeNull();
    expect(replacedByQuoteIdFromSnapshot({ replacedByQuoteId: "new-2" })).toBe("new-2");
    expect(replacedByQuoteIdFromSnapshot({ replacedByQuoteId: "" })).toBeNull();
  });
});

describe("expiredPublicNoticeKind", () => {
  it("links to the replacement only when its public token is known", () => {
    expect(
      expiredPublicNoticeKind({ expired: true, replacedByPublicToken: "tok-1" }),
    ).toEqual({ kind: "replaced", publicPath: "/proposal/tok-1" });
    expect(expiredPublicNoticeKind({ expired: true, replacedByPublicToken: null })).toEqual({
      kind: "expired",
    });
    expect(expiredPublicNoticeKind({ expired: false, replacedByPublicToken: null })).toBeNull();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordFeedback, recordFiveStar, recordOpen } from "./actions";

const mocks = vi.hoisted(() => ({
  updateMany: vi.fn(),
  find: vi.fn(),
  headersGet: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { reviewRequest: { updateMany: mocks.updateMany } },
}));
vi.mock("@/lib/reviews/publicAccess", () => ({
  findPublicReviewRequest: mocks.find,
}));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: mocks.headersGet }),
}));

const FOUND = {
  brand: { id: "brand-1", name: "Example Co" },
  request: { id: "req-1", token: "tok-1", brandId: "brand-1" },
};

beforeEach(() => {
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.find.mockResolvedValue(FOUND);
  mocks.headersGet.mockReturnValue("app.example.test");
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("recordOpen", () => {
  it("sets openedAt for the host-scoped request", async () => {
    await recordOpen("tok-1");
    expect(mocks.find).toHaveBeenCalledWith({ hostname: "app.example.test", token: "tok-1" });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "req-1", brandId: "brand-1", openedAt: null },
      data: { openedAt: expect.any(Date) },
    });
  });

  it("does not write when the host brand does not own the token", async () => {
    mocks.find.mockResolvedValue(null);
    await recordOpen("tok-1");
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});

describe("recordFiveStar", () => {
  it("stamps FIVE_STAR, rating 5, and clickedAt", async () => {
    await recordFiveStar("tok-1");
    expect(mocks.updateMany).toHaveBeenCalledTimes(1);
    const arg = mocks.updateMany.mock.calls[0][0] as {
      where: unknown;
      data: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ id: "req-1", brandId: "brand-1", outcome: null });
    expect(arg.data).toMatchObject({
      outcome: "FIVE_STAR",
      feedbackRating: 5,
    });
    expect(arg.data.clickedAt).toBeInstanceOf(Date);
  });

  it("does not write when the request is not on this host", async () => {
    mocks.find.mockResolvedValue(null);
    await recordFiveStar("tok-1");
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});

describe("recordFeedback", () => {
  it("stores FEEDBACK without clickedAt", async () => {
    await recordFeedback("tok-1", 4, "  helpful  ");
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "req-1", brandId: "brand-1", outcome: null },
      data: {
        outcome: "FEEDBACK",
        feedbackRating: 4,
        feedbackText: "helpful",
      },
    });
    const data = mocks.updateMany.mock.calls[0][0].data as Record<string, unknown>;
    expect(data).not.toHaveProperty("clickedAt");
  });

  it.each([0, 5, 6, 3.5, Number.NaN])("rejects rating %s", async (rating) => {
    await expect(recordFeedback("tok-1", rating, "ok")).rejects.toThrow(
      "Choose a rating from 1 to 4 for private feedback.",
    );
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("rejects feedback longer than 2000 characters", async () => {
    await expect(recordFeedback("tok-1", 3, "x".repeat(2001))).rejects.toThrow(
      "Feedback must be 2000 characters or fewer.",
    );
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("rejects feedback when the host brand does not own the token", async () => {
    mocks.find.mockResolvedValue(null);
    await expect(recordFeedback("tok-1", 4, "ok")).rejects.toThrow(
      "This review request is not available.",
    );
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});

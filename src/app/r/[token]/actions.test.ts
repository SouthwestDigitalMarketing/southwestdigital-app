import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordFeedback, recordGoogleClick } from "./actions";

const mocks = vi.hoisted(() => ({ updateMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { reviewRequest: { updateMany: mocks.updateMany } },
}));

beforeEach(() => {
  mocks.updateMany.mockResolvedValue({ count: 1 });
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("recordGoogleClick", () => {
  it("sets clickedAt and never writes FIVE_STAR", async () => {
    await recordGoogleClick("tok-1");
    expect(mocks.updateMany).toHaveBeenCalledTimes(1);
    const arg = mocks.updateMany.mock.calls[0][0] as {
      where: unknown;
      data: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ token: "tok-1", clickedAt: null });
    expect(arg.data.clickedAt).toBeInstanceOf(Date);
    expect(arg.data).not.toHaveProperty("outcome");
    expect(JSON.stringify(arg)).not.toContain("FIVE_STAR");
  });
});

describe("recordFeedback", () => {
  it("stores FEEDBACK without clickedAt", async () => {
    await recordFeedback("tok-1", 4, "  helpful  ");
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { token: "tok-1", outcome: null },
      data: {
        outcome: "FEEDBACK",
        feedbackRating: 4,
        feedbackText: "helpful",
      },
    });
    const data = mocks.updateMany.mock.calls[0][0].data as Record<string, unknown>;
    expect(data).not.toHaveProperty("clickedAt");
  });

  it.each([0, 6, 3.5, Number.NaN])("rejects rating %s", async (rating) => {
    await expect(recordFeedback("tok-1", rating, "ok")).rejects.toThrow("Choose a rating from 1 to 5.");
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("rejects feedback longer than 2000 characters", async () => {
    await expect(recordFeedback("tok-1", 3, "x".repeat(2001))).rejects.toThrow(
      "Feedback must be 2000 characters or fewer.",
    );
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});

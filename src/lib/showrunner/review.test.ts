import { describe, expect, it } from "vitest";
import { parseReview } from "./review";

describe("parseReview", () => {
  it("keeps the items, recomputes the score and clamps points to each item's max", () => {
    const review = parseReview({
      reviewedAt: "2026-11-25T16:11:00Z",
      videoId: "NGpxfawEGy0",
      score: 999,
      items: [
        { id: "1", title: "Speaks to one of our two viewers", points: 3, max: 8, reason: "Leads with the car.", at: "" },
        { id: "A", title: "Cold open", points: 50, max: 10, reason: "None.", at: "0:00" },
      ],
      fixNow: { title: "I Need $6,000", thumbnailText: "$6,000 BY DECEMBER", notes: ["Add captions"] },
      nextTime: "Open with the reveal.",
    });
    expect(review?.score).toBe(13);
    expect(review?.items[1].points).toBe(10);
    expect(review?.fixNow.thumbnailText).toBe("$6,000 BY DECEMBER");
  });

  it("refuses a review without items", () => {
    expect(parseReview({ items: [] })).toBeNull();
    expect(parseReview(null)).toBeNull();
  });
});

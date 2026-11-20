import { describe, expect, it } from "vitest";
import { campaignFromRow, mapLink } from "./campaigns";

describe("mapLink", () => {
  it("points OpenStreetMap at the pin", () => {
    expect(mapLink({ label: "x", latitude: 30.424, longitude: -95.62, radiusMiles: 1 })).toBe(
      "https://www.openstreetmap.org/?mlat=30.424&mlon=-95.62#map=14/30.424/-95.62",
    );
  });
});

describe("campaignFromRow", () => {
  it("turns a saved draft into a card, dropping malformed pins", () => {
    const card = campaignFromRow({
      id: "c1", name: "Bentwater", status: "draft", area: "Bentwater",
      pins: [{ label: "west", latitude: 30.4, longitude: -95.6, radiusMiles: 1 }, { label: "bad" }],
      offer: "o", landingPage: "https://x.com", headline: "h", primaryText: "t", callToAction: "Book now",
      dailyBudgetCents: 750,
    });
    expect(card.pins).toHaveLength(1);
    expect(card.dailyBudgetUsd).toBe(7.5);
    expect(card.status).toBe("draft");
  });
});

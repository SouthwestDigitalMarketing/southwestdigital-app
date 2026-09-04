import { describe, expect, it } from "vitest";
import {
  builderHref,
  HOURLY_OFFER_KINDS,
  isHourlyOfferKind,
  isOfferKindKey,
  OFFER_KINDS,
} from "./kinds";

describe("offer kinds", () => {
  it("includes bookkeeping, consulting, coaching, and referral-network", () => {
    const keys = OFFER_KINDS.map((kind) => kind.key);
    expect(keys).toContain("bookkeeping");
    expect(keys).toContain("consulting");
    expect(keys).toContain("coaching");
    expect(keys).toContain("referral-network");
  });

  it("HOURLY_OFFER_KINDS covers exactly consulting and coaching", () => {
    expect(HOURLY_OFFER_KINDS).toEqual(["consulting", "coaching"]);
  });

  it("isOfferKindKey accepts known kinds only", () => {
    expect(isOfferKindKey("bookkeeping")).toBe(true);
    expect(isOfferKindKey("consulting")).toBe(true);
    expect(isOfferKindKey("coaching")).toBe(true);
    expect(isOfferKindKey("random")).toBe(false);
  });

  it("isHourlyOfferKind treats bookkeeping and referral-network as non-hourly", () => {
    expect(isHourlyOfferKind("consulting")).toBe(true);
    expect(isHourlyOfferKind("coaching")).toBe(true);
    expect(isHourlyOfferKind("bookkeeping")).toBe(false);
    expect(isHourlyOfferKind("referral-network")).toBe(false);
    expect(isHourlyOfferKind("random")).toBe(false);
  });
});

describe("builderHref", () => {
  it("routes bookkeeping to /offers/new without a kind param", () => {
    const href = builderHref("bookkeeping", ["c1"], "q1");
    expect(href.startsWith("/offers/new?")).toBe(true);
    expect(href).toContain("contacts=c1");
    expect(href).toContain("offer=q1");
    expect(href).not.toContain("kind=");
  });

  it("routes consulting through the shared hourly builder with a kind param", () => {
    const href = builderHref("consulting", ["c1"]);
    expect(href.startsWith("/offers/hourly?")).toBe(true);
    expect(href).toContain("kind=consulting");
  });

  it("routes coaching through the shared hourly builder with a kind param", () => {
    const href = builderHref("coaching", []);
    expect(href.startsWith("/offers/hourly?")).toBe(true);
    expect(href).toContain("kind=coaching");
  });

  it("routes referral-network to its dedicated page", () => {
    const href = builderHref("referral-network", ["c1"]);
    expect(href.startsWith("/offers/referral?")).toBe(true);
    expect(href).not.toContain("kind=referral-network");
  });
});

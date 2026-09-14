import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseGoogleReviewUrl, resolveGoogleReviewUrl } from "./googleDestination";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { brandIntegration: { findUnique: mocks.findUnique } },
}));

const BRAND_URL = "https://g.page/r/example-brand/review";

beforeEach(() => {
  vi.stubEnv("GOOGLE_REVIEW_URL", "https://env-should-not-win.example/review");
  mocks.findUnique.mockResolvedValue({ status: "ACTIVE", publicIdentifier: BRAND_URL });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("parseGoogleReviewUrl", () => {
  it("accepts an https URL", () => {
    expect(parseGoogleReviewUrl(` ${BRAND_URL} `)).toBe(BRAND_URL);
  });

  it("rejects http", () => {
    expect(() => parseGoogleReviewUrl("http://maps.google.com/review")).toThrow("must use https");
  });

  it("rejects credentials in the URL", () => {
    expect(() => parseGoogleReviewUrl("https://user:secret@maps.google.com/review")).toThrow(
      "cannot include credentials",
    );
  });
});

describe("resolveGoogleReviewUrl", () => {
  it("returns the brand URL and ignores GOOGLE_REVIEW_URL", async () => {
    await expect(resolveGoogleReviewUrl("brand-1")).resolves.toBe(BRAND_URL);
  });

  it("returns null when the integration is missing or inactive", async () => {
    mocks.findUnique.mockResolvedValue(null);
    await expect(resolveGoogleReviewUrl("brand-1")).resolves.toBeNull();
    mocks.findUnique.mockResolvedValue({ status: "DISCONNECTED", publicIdentifier: BRAND_URL });
    await expect(resolveGoogleReviewUrl("brand-1")).resolves.toBeNull();
  });
});

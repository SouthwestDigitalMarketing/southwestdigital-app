import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewOutcome } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  headersGet: vi.fn(),
  find: vi.fn(),
  google: vi.fn(),
  requestOrigin: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => ({ get: mocks.headersGet }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/reviews/publicAccess", () => ({
  findPublicReviewRequest: mocks.find,
}));
vi.mock("@/lib/reviews/googleDestination", () => ({
  resolveGoogleReviewUrl: mocks.google,
}));
vi.mock("@/lib/stripe/requestOrigin", () => ({
  requestOrigin: mocks.requestOrigin,
}));

import PublicReviewPage, { generateMetadata } from "./page";

const THEME = {
  lightColor: "#17324d",
  accentColor: "#d79b3b",
  logoUrl: "https://cdn.example/wordmark-navy.webp",
  logoDarkUrl: "https://cdn.example/wordmark-white.webp",
  logoMarkUrl: "https://cdn.example/mark.webp",
  logoAlt: null,
};

const FOUND = {
  brand: { id: "brand-1", name: "Example Co", theme: THEME },
  request: {
    id: "req-1",
    token: "tok-1",
    brandId: "brand-1",
    recipientName: "Jane",
    openedAt: null,
    clickedAt: null,
    outcome: null,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headersGet.mockReturnValue("app.example.test");
  mocks.find.mockResolvedValue(FOUND);
  mocks.google.mockResolvedValue("https://maps.google.com/?q=example");
  mocks.requestOrigin.mockReturnValue("https://app.example.test");
});

describe("public review page logo", () => {
  it("passes the full light-background wordmark, not the mark or brand-name-only header", async () => {
    const el = (await PublicReviewPage({
      params: Promise.resolve({ token: "tok-1" }),
    })) as { props: Record<string, unknown> };
    expect(el.props.logoUrl).toBe("https://cdn.example/wordmark-navy.webp");
    expect(el.props.logoUrl).not.toBe(THEME.logoMarkUrl);
    expect(el.props.logoAlt).toBe("Example Co logo");
    expect(el.props.brandName).toBe("Example Co");
    expect(el.props.lightColor).toBe("#17324d");
  });

  it("passes a null logo URL when the wordmark is missing", async () => {
    mocks.find.mockResolvedValue({
      ...FOUND,
      brand: { ...FOUND.brand, theme: { ...THEME, logoUrl: null } },
      request: { ...FOUND.request, outcome: ReviewOutcome.FEEDBACK, openedAt: new Date() },
    });
    const el = (await PublicReviewPage({
      params: Promise.resolve({ token: "tok-1" }),
    })) as { props: Record<string, unknown> };
    expect(el.props.logoUrl).toBeNull();
  });
});

describe("public review generateMetadata", () => {
  it("sets OG title and og:image to the composed white-on-navy route", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ token: "tok-1" }) });
    expect(metadata.title).toBe("Review Example Co");
    expect(metadata.openGraph).toEqual({
      title: "Review Example Co",
      images: [
        {
          url: "/r/tok-1/opengraph-image",
          width: 1200,
          height: 630,
          alt: "Example Co logo",
        },
      ],
    });
    expect(metadata.metadataBase).toEqual(new URL("https://app.example.test"));
    expect(mocks.find).toHaveBeenCalledWith({ hostname: "app.example.test", token: "tok-1" });
  });

  it("does not invent a review title when the token is unknown", async () => {
    mocks.find.mockResolvedValue(null);
    await expect(
      generateMetadata({ params: Promise.resolve({ token: "missing" }) }),
    ).resolves.toEqual({ title: "Review" });
  });
});

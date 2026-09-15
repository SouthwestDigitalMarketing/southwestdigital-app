import { afterEach, describe, expect, it, vi } from "vitest";
import {
  REVIEW_OG_IMAGE_SIZE,
  REVIEW_OG_NAVY_FALLBACK,
  loadPublicReviewOgWordmarkSrc,
  publicReviewMetadata,
  publicReviewOgImageSpec,
  publicReviewOpenGraphImagePath,
  publicReviewPageLogoAlt,
  publicReviewPageLogoUrl,
  publicReviewTitle,
} from "./publicReviewPresentation";

const THEME = {
  lightColor: "#17324d",
  accentColor: "#d79b3b",
  logoUrl: "https://cdn.example/wordmark-navy.webp",
  logoDarkUrl: "https://cdn.example/wordmark-white.webp",
  logoMarkUrl: "https://cdn.example/mark.webp",
  logoAlt: "Bookkeeping Conroe",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("public review page logo", () => {
  it("uses the light-background full wordmark, not the mark", () => {
    expect(publicReviewPageLogoUrl(THEME)).toBe("https://cdn.example/wordmark-navy.webp");
    expect(publicReviewPageLogoUrl(THEME)).not.toBe(THEME.logoMarkUrl);
    expect(publicReviewPageLogoUrl({ ...THEME, logoUrl: "  " })).toBeNull();
    expect(publicReviewPageLogoUrl(null)).toBeNull();
  });

  it("falls back to brand-name alt text", () => {
    expect(publicReviewPageLogoAlt(THEME, "Ignored")).toBe("Bookkeeping Conroe");
    expect(publicReviewPageLogoAlt({ ...THEME, logoAlt: null }, "Example Co")).toBe(
      "Example Co logo",
    );
  });
});

describe("public review OG image spec", () => {
  it("composites the dark-background wordmark on brand navy", () => {
    expect(publicReviewOgImageSpec(THEME)).toEqual({
      backgroundColor: "#17324d",
      wordmarkUrl: "https://cdn.example/wordmark-white.webp",
    });
  });

  it("falls back to navy and does not invent a white wordmark from logoUrl", () => {
    expect(
      publicReviewOgImageSpec({
        lightColor: "  ",
        logoUrl: THEME.logoUrl,
        logoDarkUrl: null,
        logoMarkUrl: THEME.logoMarkUrl,
      }),
    ).toEqual({
      backgroundColor: REVIEW_OG_NAVY_FALLBACK,
      wordmarkUrl: null,
    });
  });

  it("does not put the white wordmark on a light lightColor", () => {
    expect(
      publicReviewOgImageSpec({
        lightColor: "#f5f5f5",
        darkColor: "#1b263b",
        logoDarkUrl: THEME.logoDarkUrl,
      }),
    ).toEqual({
      backgroundColor: "#1b263b",
      wordmarkUrl: THEME.logoDarkUrl,
    });
  });
});

describe("public review OG metadata", () => {
  it("sets a basic OG title and points og:image at the composed route", () => {
    const metadata = publicReviewMetadata({
      brandName: "Example Co",
      token: "tok-1",
      origin: "https://app.example.test",
      theme: THEME,
    });
    expect(metadata.title).toBe("Review Example Co");
    expect(publicReviewTitle("Example Co")).toBe("Review Example Co");
    expect(metadata.metadataBase.href).toBe("https://app.example.test/");
    expect(metadata.openGraph).toEqual({
      title: "Review Example Co",
      images: [
        {
          url: publicReviewOpenGraphImagePath("tok-1"),
          width: REVIEW_OG_IMAGE_SIZE.width,
          height: REVIEW_OG_IMAGE_SIZE.height,
          alt: "Bookkeeping Conroe",
        },
      ],
    });
    expect(metadata.openGraph.images[0]?.url).toBe("/r/tok-1/opengraph-image");
  });
});

describe("loadPublicReviewOgWordmarkSrc", () => {
  it("returns a data URL for an http(s) image and skips missing or non-image sources", async () => {
    expect(await loadPublicReviewOgWordmarkSrc(null)).toBeNull();
    expect(await loadPublicReviewOgWordmarkSrc("not-a-url")).toBeNull();
    expect(await loadPublicReviewOgWordmarkSrc("ftp://cdn.example/logo.webp")).toBeNull();

    const fetchImpl = vi.fn(async () =>
      new Response(Buffer.from("png-bytes"), {
        status: 200,
        headers: { "content-type": "image/webp" },
      }),
    ) as unknown as typeof fetch;
    await expect(
      loadPublicReviewOgWordmarkSrc("https://cdn.example/wordmark-white.webp", fetchImpl),
    ).resolves.toBe(`data:image/webp;base64,${Buffer.from("png-bytes").toString("base64")}`);

    const notImage = vi.fn(async () =>
      new Response("nope", { status: 200, headers: { "content-type": "text/html" } }),
    ) as unknown as typeof fetch;
    await expect(
      loadPublicReviewOgWordmarkSrc("https://cdn.example/wordmark-white.webp", notImage),
    ).resolves.toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { resolveCoverMedia, resolveVideoPosterUrl } from "./coverMedia";

describe("resolveCoverMedia", () => {
  const brandDefaults = {
    videoUrl: "https://youtube.com/watch?v=brand",
    imageUrl: "https://cdn.example.com/brand.jpg",
  };

  it("uses brand defaults when no library item is selected", () => {
    expect(
      resolveCoverMedia(
        { featuredMediaId: "", featuredVideoUrl: "", featuredImageUrl: "" },
        brandDefaults,
      ),
    ).toEqual({
      videoUrl: brandDefaults.videoUrl,
      imageUrl: brandDefaults.imageUrl,
    });
  });

  it("does not fall back to the brand video when a library image is selected", () => {
    expect(
      resolveCoverMedia(
        {
          featuredMediaId: "media_1",
          featuredVideoUrl: "",
          featuredImageUrl: "https://cdn.example.com/selected.jpg",
        },
        brandDefaults,
      ),
    ).toEqual({
      videoUrl: "",
      imageUrl: "https://cdn.example.com/selected.jpg",
    });
  });

  it("uses the selected library video without mixing in the brand image", () => {
    expect(
      resolveCoverMedia(
        {
          featuredMediaId: "media_2",
          featuredVideoUrl: "https://youtube.com/watch?v=selected",
          featuredImageUrl: "",
        },
        brandDefaults,
      ),
    ).toEqual({
      videoUrl: "https://youtube.com/watch?v=selected",
      imageUrl: "",
    });
  });
});

describe("resolveVideoPosterUrl", () => {
  it("uses the Cloudflare Stream thumbnail for a Stream embed", () => {
    expect(resolveVideoPosterUrl("https://customer-abc.cloudflarestream.com/0123abcd/iframe")).toBe(
      "https://customer-abc.cloudflarestream.com/0123abcd/thumbnails/thumbnail.jpg?height=720",
    );
  });

  it("uses the YouTube thumbnail for a YouTube embed", () => {
    expect(resolveVideoPosterUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    );
  });

  it("returns null for platforms without a public thumbnail URL and for bad input", () => {
    expect(resolveVideoPosterUrl("https://player.vimeo.com/video/123")).toBeNull();
    expect(resolveVideoPosterUrl("not a url")).toBeNull();
    expect(resolveVideoPosterUrl(null)).toBeNull();
  });
});

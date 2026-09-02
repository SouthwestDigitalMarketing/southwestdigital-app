import { describe, expect, it } from "vitest";
import { resolveCoverMedia } from "./coverMedia";

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

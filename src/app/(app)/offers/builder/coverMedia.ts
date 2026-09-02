export type CoverMediaSelection = {
  featuredMediaId: string;
  featuredVideoUrl: string;
  featuredImageUrl: string;
};

export function resolveCoverMedia(
  selection: CoverMediaSelection,
  brandDefaults: { videoUrl: string | null; imageUrl: string | null },
) {
  if (selection.featuredMediaId) {
    return {
      videoUrl: selection.featuredVideoUrl || "",
      imageUrl: selection.featuredImageUrl || "",
    };
  }

  return {
    videoUrl: selection.featuredVideoUrl || brandDefaults.videoUrl || "",
    imageUrl: selection.featuredImageUrl || brandDefaults.imageUrl || "",
  };
}

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

// A still image for an embedded cover video, shown while the player loads.
// Takes the iframe embed URL; returns null when the platform has no public thumbnail URL.
export function resolveVideoPosterUrl(embedUrl: string | null): string | null {
  if (!embedUrl) return null;
  try {
    const u = new URL(embedUrl);
    if (u.hostname.endsWith(".cloudflarestream.com") && u.pathname.endsWith("/iframe")) {
      const videoPath = u.pathname.slice(0, -"/iframe".length);
      return `${u.origin}${videoPath}/thumbnails/thumbnail.jpg?height=720`;
    }
    if ((u.hostname === "www.youtube.com" || u.hostname === "youtube.com") && u.pathname.startsWith("/embed/")) {
      const id = u.pathname.slice("/embed/".length).split("/")[0];
      return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
    }
    return null;
  } catch {
    return null;
  }
}

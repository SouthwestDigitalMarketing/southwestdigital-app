import "server-only";
import { getAccessToken } from "./analytics";

export type SourceTagVideo = { title: string; videoId: string; thumbnailUrl: string };

// Builds a pattern that captures the tag (last character) from a redirect URL.
// bc brand uses prefixed two-char paths: /s[a-z] and /b[a-z] → tag = last char
// other brands use single-char paths: /[a-z] → tag = that char
function buildTagPattern(redirectDomain: string, brandSlug: string) {
  const escaped = redirectDomain.replace(/\./g, "\\.");
  const pathPattern =
    brandSlug === "bc"
      ? `(?:s|b)([a-z])` // two-char prefixed: capture last char
      : `([a-z0-9])`;    // single char
  return new RegExp(`${escaped}/${pathPattern}(?![a-z0-9])`, "gi");
}

export function extractSourceTag(description: string, redirectDomain: string, brandSlug: string): string | null {
  const pattern = buildTagPattern(redirectDomain, brandSlug);
  const firstLine = description.split("\n").find((l) => l.trim() !== "") ?? "";
  const firstMatch = new RegExp(pattern.source, "i").exec(firstLine);
  if (firstMatch) return firstMatch[1].toLowerCase();

  const allMatches = [...description.matchAll(pattern)].map((m) => m[1].toLowerCase());
  const unique = new Set(allMatches);
  return unique.size === 1 ? [...unique][0] : null;
}

export async function getSourceTagVideos(
  channelId: string,
  refreshToken: string,
  redirectDomain: string,
  brandSlug: string,
  limit = 100,
): Promise<Map<string, SourceTagVideo>> {
  const accessToken = await getAccessToken(refreshToken);

  // Resolve the uploads playlist ID
  const chRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!chRes.ok) throw new Error(`YouTube channels API HTTP ${chRes.status}`);
  type ChJson = { items?: [{ contentDetails?: { relatedPlaylists?: { uploads?: string } } }] };
  const chJson = (await chRes.json()) as ChJson;
  const playlistId = chJson.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!playlistId) throw new Error("Could not resolve uploads playlist for channel.");

  // Page through the uploads playlist to collect descriptions
  const byTag = new Map<string, SourceTagVideo>();
  let pageToken: string | undefined;

  while (byTag.size < limit) {
    const params = new URLSearchParams({
      part: "snippet,contentDetails",
      playlistId,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    const plRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!plRes.ok) break;
    type PlJson = {
      nextPageToken?: string;
      items?: Array<{
        snippet?: { title?: string; description?: string };
        contentDetails?: { videoId?: string };
      }>;
    };
    const plJson = (await plRes.json()) as PlJson;
    for (const item of plJson.items ?? []) {
      const videoId = item.contentDetails?.videoId;
      const title = item.snippet?.title ?? "";
      const description = item.snippet?.description ?? "";
      if (!videoId) continue;
      const tag = extractSourceTag(description, redirectDomain, brandSlug);
      if (tag && !byTag.has(tag)) {
        byTag.set(tag, {
          title,
          videoId,
          thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        });
      }
    }
    pageToken = plJson.nextPageToken;
    if (!pageToken) break;
  }

  return byTag;
}

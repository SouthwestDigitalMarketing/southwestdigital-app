import "server-only";
import { getAccessToken } from "./analytics";

export type ChannelUpload = { videoId: string; title: string; publishedAt: string; thumbnailUrl: string };

/** The channel's uploads playlist, newest first (public, unlisted and scheduled uploads alike). */
export async function getChannelUploads(channelId: string, refreshToken: string, limit = 200): Promise<ChannelUpload[]> {
  const accessToken = await getAccessToken(refreshToken);
  const headers = { Authorization: `Bearer ${accessToken}` };

  const chRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${encodeURIComponent(channelId)}`,
    { headers },
  );
  if (!chRes.ok) throw new Error(`YouTube channels API HTTP ${chRes.status}`);
  type ChJson = { items?: [{ contentDetails?: { relatedPlaylists?: { uploads?: string } } }] };
  const playlistId = ((await chRes.json()) as ChJson).items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!playlistId) throw new Error("Could not resolve uploads playlist for channel.");

  const uploads: ChannelUpload[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      part: "snippet,contentDetails",
      playlistId,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`, { headers });
    if (!res.ok) throw new Error(`YouTube playlistItems API HTTP ${res.status}`);
    type PlJson = {
      nextPageToken?: string;
      items?: Array<{
        snippet?: { title?: string };
        contentDetails?: { videoId?: string; videoPublishedAt?: string };
      }>;
    };
    const json = (await res.json()) as PlJson;
    for (const item of json.items ?? []) {
      const videoId = item.contentDetails?.videoId;
      if (!videoId) continue;
      uploads.push({
        videoId,
        title: item.snippet?.title ?? videoId,
        publishedAt: item.contentDetails?.videoPublishedAt ?? "",
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      });
    }
    pageToken = json.nextPageToken;
  } while (pageToken && uploads.length < limit);

  return uploads
    .slice(0, limit)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

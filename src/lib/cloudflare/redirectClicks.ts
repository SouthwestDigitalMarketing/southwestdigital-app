import "server-only";

const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i));

// The possible tag values (a-z) — used to write zero rows for missing days
export const SOURCE_TAG_CHARS = LETTERS;

// Brand-specific path lists. Tag is always the LAST character of the path.
// bc:   community = /s[a-z], services = /b[a-z]
// default: /[a-z] (single char, used for TREB services on bookkeepingconroe.com)
export function getBrandSourceTagPaths(brandSlug: string): string[] {
  if (brandSlug === "bc") {
    return [...LETTERS.map((l) => `/s${l}`), ...LETTERS.map((l) => `/b${l}`)];
  }
  return LETTERS.map((l) => `/${l}`);
}

export type SourceTagClick = { tag: string; clicks: number };

export type SourceTagClickReport = {
  totalClicks: number;
  byTag: SourceTagClick[];
  epochDate: string;
  generatedAt: string;
};

// Batch multiple single-day queries into one GraphQL request using field aliasing.
// Each day uses filter: { date: "YYYY-MM-DD" } which satisfies Cloudflare's 1-day range limit.
// Tag is extracted as the last character of the path so /sa and /ba both map to tag "a".
export async function fetchClicksForDays(
  days: string[],
  zoneId: string,
  apiToken: string,
  paths: string[],
): Promise<Map<string, Map<string, number>>> {
  const byDay = new Map<string, Map<string, number>>();
  if (days.length === 0) return byDay;

  const aliasedDays = days
    .map(
      (day, i) => `
        d${i}: httpRequestsAdaptiveGroups(
          filter: {
            date: "${day}"
            clientRequestPath_in: ${JSON.stringify(paths)}
          }
          limit: 100
        ) {
          count
          dimensions { clientRequestPath }
        }`,
    )
    .join("\n");

  const query = `{
    viewer {
      zones(filter: { zoneTag: "${zoneId}" }) {
        ${aliasedDays}
      }
    }
  }`;

  const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error(`Cloudflare Analytics API HTTP ${res.status}`);

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`Cloudflare Analytics API error: ${json.errors[0].message}`);
  }

  const zone: Record<string, Array<{ count: number; dimensions: { clientRequestPath: string } }>> =
    json?.data?.viewer?.zones?.[0] ?? {};

  days.forEach((day, i) => {
    const tagMap = new Map<string, number>();
    for (const group of zone[`d${i}`] ?? []) {
      // Last character is the video tag regardless of prefix (/sa → a, /ba → a, /a → a)
      const tag = group.dimensions.clientRequestPath.slice(-1);
      tagMap.set(tag, (tagMap.get(tag) ?? 0) + group.count);
    }
    byDay.set(day, tagMap);
  });

  return byDay;
}

export function getCloudflareCredentials(brandSlug: string): { token: string; zoneId: string } {
  const key = brandSlug.toUpperCase().replace(/-/g, "_");
  const token = process.env[`CLOUDFLARE_API_${key}`]?.trim();
  const zoneId = process.env[`CLOUDFLARE_ZONE_ID_${key}`]?.trim();
  if (!token) throw new Error(`CLOUDFLARE_API_${key} is not configured.`);
  if (!zoneId) throw new Error(`CLOUDFLARE_ZONE_ID_${key} is not configured.`);
  return { token, zoneId };
}

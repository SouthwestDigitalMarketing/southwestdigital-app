import { contrastRatio } from "@/lib/brands/colors";

export const REVIEW_OG_NAVY_FALLBACK = "#17324d";
export const REVIEW_OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

export type PublicReviewTheme = {
  lightColor?: string | null;
  darkColor?: string | null;
  accentColor?: string | null;
  logoUrl?: string | null;
  logoDarkUrl?: string | null;
  logoMarkUrl?: string | null;
  logoAlt?: string | null;
} | null | undefined;

function trimmed(value: string | null | undefined): string | null {
  const next = value?.trim() ?? "";
  return next.length > 0 ? next : null;
}

/** Dark full wordmark for the white public review page. Never the mark. */
export function publicReviewPageLogoUrl(theme: PublicReviewTheme): string | null {
  return trimmed(theme?.logoUrl);
}

export function publicReviewPageLogoAlt(
  theme: PublicReviewTheme,
  brandName: string,
): string {
  return trimmed(theme?.logoAlt) ?? `${brandName} logo`;
}

export function publicReviewPageColors(theme: PublicReviewTheme): {
  lightColor: string;
  accentColor: string;
} {
  return {
    lightColor: trimmed(theme?.lightColor) ?? REVIEW_OG_NAVY_FALLBACK,
    accentColor: trimmed(theme?.accentColor) ?? "#d79b3b",
  };
}

/** White full wordmark for the navy OG/SMS unfurl. Never invented from logoUrl. */
export function publicReviewOgWordmarkUrl(theme: PublicReviewTheme): string | null {
  return trimmed(theme?.logoDarkUrl);
}

function holdsWhiteWordmark(color: string): boolean {
  const ratio = contrastRatio("#ffffff", color);
  return ratio !== null && ratio >= 4.5;
}

export function publicReviewOgBackground(theme: PublicReviewTheme): string {
  const preferred = trimmed(theme?.lightColor);
  if (preferred && holdsWhiteWordmark(preferred)) return preferred;
  const dark = trimmed(theme?.darkColor);
  if (dark && holdsWhiteWordmark(dark)) return dark;
  return REVIEW_OG_NAVY_FALLBACK;
}

export function publicReviewOgImageSpec(theme: PublicReviewTheme): {
  backgroundColor: string;
  wordmarkUrl: string | null;
} {
  return {
    backgroundColor: publicReviewOgBackground(theme),
    wordmarkUrl: publicReviewOgWordmarkUrl(theme),
  };
}

export function publicReviewOpenGraphImagePath(token: string): string {
  return `/r/${encodeURIComponent(token)}/opengraph-image`;
}

export function publicReviewTitle(brandName: string): string {
  return `Review ${brandName}`;
}

export function publicReviewMetadata(input: {
  brandName: string;
  token: string;
  origin: string;
  theme: PublicReviewTheme;
}): {
  title: string;
  metadataBase: URL;
  openGraph: {
    title: string;
    images: Array<{ url: string; width: number; height: number; alt: string }>;
  };
} {
  const title = publicReviewTitle(input.brandName);
  return {
    title,
    metadataBase: new URL(input.origin),
    openGraph: {
      title,
      images: [
        {
          url: publicReviewOpenGraphImagePath(input.token),
          width: REVIEW_OG_IMAGE_SIZE.width,
          height: REVIEW_OG_IMAGE_SIZE.height,
          alt: publicReviewPageLogoAlt(input.theme, input.brandName),
        },
      ],
    },
  };
}

export async function loadPublicReviewOgWordmarkSrc(
  wordmarkUrl: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  if (!wordmarkUrl) return null;
  let parsed: URL;
  try {
    parsed = new URL(wordmarkUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  try {
    const response = await fetchImpl(parsed, {
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!contentType.startsWith("image/")) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0) return null;
    return `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}

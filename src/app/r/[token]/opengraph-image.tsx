import { ImageResponse } from "next/og";
import { headers } from "next/headers";
import { findPublicReviewRequest } from "@/lib/reviews/publicAccess";
import {
  REVIEW_OG_IMAGE_SIZE,
  loadPublicReviewOgWordmarkSrc,
  publicReviewOgImageSpec,
  publicReviewPageLogoAlt,
} from "@/lib/reviews/publicReviewPresentation";

export const runtime = "nodejs";
export const alt = "Review";
export const size = REVIEW_OG_IMAGE_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const hostname = (await headers()).get("x-hostname");
  const found = await findPublicReviewRequest({ hostname, token });
  if (!found) {
    return new Response("Not found", { status: 404 });
  }

  const spec = publicReviewOgImageSpec(found.brand.theme);
  const wordmarkSrc = await loadPublicReviewOgWordmarkSrc(spec.wordmarkUrl);
  const wordmarkAlt = publicReviewPageLogoAlt(found.brand.theme, found.brand.name);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: spec.backgroundColor,
          padding: 80,
        }}
      >
        {wordmarkSrc ? (
          <img
            src={wordmarkSrc}
            alt={wordmarkAlt}
            width={960}
            height={320}
            style={{ objectFit: "contain" }}
          />
        ) : null}
      </div>
    ),
    { ...size },
  );
}

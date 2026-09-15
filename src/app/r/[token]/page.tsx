import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ReviewOutcome } from "@prisma/client";
import { findPublicReviewRequest } from "@/lib/reviews/publicAccess";
import { resolveGoogleReviewUrl } from "@/lib/reviews/googleDestination";
import {
  publicReviewMetadata,
  publicReviewPageColors,
  publicReviewPageLogoAlt,
  publicReviewPageLogoUrl,
} from "@/lib/reviews/publicReviewPresentation";
import { requestOrigin } from "@/lib/stripe/requestOrigin";
import { ReviewPage } from "./ReviewPage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const headerStore = await headers();
  const found = await findPublicReviewRequest({
    hostname: headerStore.get("x-hostname"),
    token,
  });
  if (!found) return { title: "Review" };
  return publicReviewMetadata({
    brandName: found.brand.name,
    token,
    origin: requestOrigin(headerStore),
    theme: found.brand.theme,
  });
}

export default async function PublicReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const hostname = (await headers()).get("x-hostname");
  const found = await findPublicReviewRequest({ hostname, token });
  if (!found) notFound();

  const googleReviewUrl = await resolveGoogleReviewUrl(found.brand.id);
  const colors = publicReviewPageColors(found.brand.theme);

  return (
    <ReviewPage
      token={token}
      recipientName={found.request.recipientName}
      brandName={found.brand.name}
      logoUrl={publicReviewPageLogoUrl(found.brand.theme)}
      logoAlt={publicReviewPageLogoAlt(found.brand.theme, found.brand.name)}
      accentColor={colors.accentColor}
      googleReviewUrl={googleReviewUrl}
      alreadyOpened={Boolean(found.request.openedAt)}
      alreadyLeftFeedback={found.request.outcome === ReviewOutcome.FEEDBACK}
    />
  );
}

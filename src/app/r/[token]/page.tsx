import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ReviewOutcome } from "@prisma/client";
import { findPublicReviewRequest } from "@/lib/reviews/publicAccess";
import { resolveGoogleReviewUrl } from "@/lib/reviews/googleDestination";
import { ReviewPage } from "./ReviewPage";

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

  return (
    <ReviewPage
      token={token}
      recipientName={found.request.recipientName}
      brandName={found.brand.name}
      lightColor={found.brand.theme?.lightColor ?? "#17324d"}
      accentColor={found.brand.theme?.accentColor ?? "#d79b3b"}
      googleReviewUrl={googleReviewUrl}
      alreadyOpened={Boolean(found.request.openedAt)}
      alreadyClickedGoogle={Boolean(found.request.clickedAt)}
      alreadyLeftFeedback={found.request.outcome === ReviewOutcome.FEEDBACK}
    />
  );
}

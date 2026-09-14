import { notFound } from "next/navigation";
import { BrandStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveGoogleReviewUrl } from "@/lib/reviews/googleDestination";
import { ReviewPage } from "./ReviewPage";

export default async function PublicReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const request = await prisma.reviewRequest.findUnique({
    where: { token },
    select: {
      id: true,
      token: true,
      recipientName: true,
      openedAt: true,
      outcome: true,
      brandId: true,
    },
  });

  if (!request) notFound();

  if (!request.openedAt && !request.outcome) {
    await prisma.reviewRequest.update({
      where: { id: request.id },
      data: { openedAt: new Date() },
    });
  }

  const brand = await prisma.brand.findFirst({
    where: { id: request.brandId, status: BrandStatus.ACTIVE },
    select: {
      name: true,
      theme: {
        select: { lightColor: true, accentColor: true },
      },
    },
  });

  if (!brand) notFound();

  const googleReviewUrl = await resolveGoogleReviewUrl(request.brandId);

  return (
    <ReviewPage
      token={token}
      recipientName={request.recipientName}
      brandName={brand.name}
      lightColor={brand.theme?.lightColor ?? "#17324d"}
      accentColor={brand.theme?.accentColor ?? "#d79b3b"}
      googleReviewUrl={googleReviewUrl}
    />
  );
}

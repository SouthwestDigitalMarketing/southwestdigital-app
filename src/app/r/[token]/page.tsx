import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
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

  // Record first open
  if (!request.openedAt && !request.outcome) {
    await prisma.reviewRequest.update({
      where: { id: request.id },
      data: { openedAt: new Date() },
    });
  }

  const brand = await prisma.brand.findUnique({
    where: { id: request.brandId },
    select: {
      name: true,
      theme: {
        select: { primaryColor: true, accentColor: true },
      },
    },
  });

  if (!brand) notFound();

  const googleReviewUrl =
    process.env.GOOGLE_REVIEW_URL ?? "https://g.page/r/CXbK2xevuLjeEAI/review";

  return (
    <ReviewPage
      token={token}
      recipientName={request.recipientName}
      brandName={brand.name}
      primaryColor={brand.theme?.primaryColor ?? "#17324d"}
      accentColor={brand.theme?.accentColor ?? "#d79b3b"}
      googleReviewUrl={googleReviewUrl}
    />
  );
}

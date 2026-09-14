import "server-only";

import { ReviewOutcome } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolvePublicBrand } from "@/lib/brands/resolve";

export type PublicReviewBrand = NonNullable<Awaited<ReturnType<typeof resolvePublicBrand>>>;

export type PublicReviewRequest = {
  id: string;
  token: string;
  brandId: string;
  recipientName: string | null;
  openedAt: Date | null;
  clickedAt: Date | null;
  outcome: ReviewOutcome | null;
};

export async function findPublicReviewRequest(input: {
  hostname: string | null;
  token: string | null;
}): Promise<{ brand: PublicReviewBrand; request: PublicReviewRequest } | null> {
  const token = input.token?.trim() ?? "";
  if (!token) return null;

  const brand = await resolvePublicBrand(input.hostname);
  if (!brand) return null;

  const request = await prisma.reviewRequest.findFirst({
    where: { brandId: brand.id, token },
    select: {
      id: true,
      token: true,
      brandId: true,
      recipientName: true,
      openedAt: true,
      clickedAt: true,
      outcome: true,
    },
  });

  if (!request) return null;
  return { brand, request };
}

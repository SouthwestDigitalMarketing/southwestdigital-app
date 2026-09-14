"use server";

import { headers } from "next/headers";
import { ReviewOutcome } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { REVIEW_FEEDBACK_TEXT_MAX } from "@/lib/reviews/policy";
import { findPublicReviewRequest } from "@/lib/reviews/publicAccess";

async function publicReviewForToken(token: string) {
  const hostname = (await headers()).get("x-hostname");
  return findPublicReviewRequest({ hostname, token });
}

export async function recordOpen(token: string) {
  const found = await publicReviewForToken(token);
  if (!found) return;
  await prisma.reviewRequest.updateMany({
    where: { id: found.request.id, brandId: found.brand.id, openedAt: null },
    data: { openedAt: new Date() },
  });
}

export async function recordFiveStar(token: string) {
  const found = await publicReviewForToken(token);
  if (!found) return;
  await prisma.reviewRequest.updateMany({
    where: { id: found.request.id, brandId: found.brand.id, outcome: null },
    data: {
      clickedAt: new Date(),
      outcome: ReviewOutcome.FIVE_STAR,
      feedbackRating: 5,
    },
  });
}

export async function recordFeedback(token: string, rating: number, text: string) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 4) {
    throw new Error("Choose a rating from 1 to 4 for private feedback.");
  }
  const feedbackText = text.trim();
  if (feedbackText.length > REVIEW_FEEDBACK_TEXT_MAX) {
    throw new Error("Feedback must be 2000 characters or fewer.");
  }

  const found = await publicReviewForToken(token);
  if (!found) {
    throw new Error("This review request is not available.");
  }

  await prisma.reviewRequest.updateMany({
    where: { id: found.request.id, brandId: found.brand.id, outcome: null },
    data: {
      outcome: ReviewOutcome.FEEDBACK,
      feedbackRating: rating,
      feedbackText: feedbackText || null,
    },
  });
}

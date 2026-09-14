"use server";

import { ReviewOutcome } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const FEEDBACK_TEXT_MAX = 2000;

export async function recordGoogleClick(token: string) {
  await prisma.reviewRequest.updateMany({
    where: { token, clickedAt: null },
    data: { clickedAt: new Date() },
  });
}

export async function recordFeedback(token: string, rating: number, text: string) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Choose a rating from 1 to 5.");
  }
  const feedbackText = text.trim();
  if (feedbackText.length > FEEDBACK_TEXT_MAX) {
    throw new Error("Feedback must be 2000 characters or fewer.");
  }

  await prisma.reviewRequest.updateMany({
    where: { token, outcome: null },
    data: {
      outcome: ReviewOutcome.FEEDBACK,
      feedbackRating: rating,
      feedbackText: feedbackText || null,
    },
  });
}

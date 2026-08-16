"use server";

import { prisma } from "@/lib/prisma";
import { ReviewOutcome } from "@prisma/client";

export async function recordFiveStar(token: string) {
  await prisma.reviewRequest.updateMany({
    where: { token, outcome: null },
    data: { outcome: ReviewOutcome.FIVE_STAR, clickedAt: new Date() },
  });
}

export async function recordFeedback(token: string, rating: number, text: string) {
  await prisma.reviewRequest.updateMany({
    where: { token, outcome: null },
    data: {
      outcome: ReviewOutcome.FEEDBACK,
      feedbackRating: rating,
      feedbackText: text,
      clickedAt: new Date(),
    },
  });
}

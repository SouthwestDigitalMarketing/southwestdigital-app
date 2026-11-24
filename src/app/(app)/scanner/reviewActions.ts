"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { isLochsideBrandSlug } from "@/lib/brands/active-brand";
import {
  UNDO_REVIEW,
  answersFor,
  isReviewKind,
  newsletterDefault,
  saveAnswers,
  type NewsletterRow,
} from "@/lib/scan/reviews";

/** Tom's mailbox: Lochside platform operators only, like the Scan button. */
async function requireMailReviewer() {
  const ctx = await requireStaffBrandOrThrow();
  if (!ctx.isPlatformOperator || !isLochsideBrandSlug(ctx.brand.slug)) throw new Error("Unauthorized");
  return ctx;
}

/** Tom presses Done on a review screen. `shownIds` are the rows on his screen;
 * `flippedIds` the ones he tapped (spam -> not spam, or keep <-> clear).
 * Defaults are worked out here from the stored rows, never from the browser. */
export async function submitReview(
  review: string,
  shownIds: string[],
  flippedIds: string[],
): Promise<{ message: string }> {
  const { session } = await requireMailReviewer();
  if (!isReviewKind(review)) throw new Error("Unknown review.");
  const actor = session.user.id ?? session.user.email ?? "staff";
  const rows = await prisma.scanReviewItem.findMany({
    where: { id: { in: shownIds.slice(0, 500) }, review, status: "pending" },
    select: { id: true, data: true },
  });
  const shown = rows.map((row) => ({
    id: row.id,
    defaultAnswer: review === "spam" ? "spam" : newsletterDefault(row.data as unknown as NewsletterRow),
  }));
  const answers = answersFor(review, shown, new Set(flippedIds));
  const saved = await saveAnswers(prisma, review, answers, actor);
  revalidatePath("/scanner");
  return {
    message: saved === 0
      ? "Nothing to send: these were already handled."
      : `Saved ${saved} answer${saved === 1 ? "" : "s"}. Ripley applies them within a minute.`,
  };
}

/** Put the last newsletter clear back (mail back from Trash, senders off the
 * always-spam list). Unsubscribes already sent cannot be taken back. */
export async function requestNewsletterUndo(): Promise<{ message: string }> {
  const { session } = await requireMailReviewer();
  const waiting = await prisma.scanReviewItem.count({ where: { review: UNDO_REVIEW, status: "answered" } });
  if (waiting > 0) return { message: "An undo is already waiting for ripley." };
  const now = new Date();
  await prisma.scanReviewItem.create({
    data: {
      review: UNDO_REVIEW,
      itemKey: now.toISOString(),
      data: {},
      status: "answered",
      answer: "undo",
      answeredBy: session.user.id ?? session.user.email ?? "staff",
      answeredAt: now,
    },
  });
  revalidatePath("/scanner");
  return { message: "Undo sent. Ripley puts the last clear back within a minute." };
}

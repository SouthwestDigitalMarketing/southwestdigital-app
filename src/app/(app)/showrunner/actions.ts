"use server";

import { revalidatePath } from "next/cache";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import { parseFeedbackInput } from "@/lib/showrunner/feedback";
import { findSuggestion } from "./suggestions";

export async function saveShowrunnerFeedback(raw: {
  seriesSlug: string;
  episodeIndex: number | null;
  reaction: string;
  note: string | null;
}) {
  const series = findSuggestion(String(raw.seriesSlug));
  if (!series) throw new Error("Unknown series");
  const input = parseFeedbackInput(raw, series.episodes.length);
  if (!input) throw new Error("Invalid feedback");

  const { dataContext } = await requireStaffBrandOrThrow();
  await withBrandDataTransaction(dataContext, (tx) =>
    tx.showrunnerFeedback.create({
      data: {
        brandId: dataContext.brandId,
        seriesSlug: input.seriesSlug,
        episodeIndex: input.episodeIndex,
        reaction: input.reaction,
        note: input.note,
        actorUserId: dataContext.actorUserId,
      },
    }),
  );

  revalidatePath(`/showrunner/new-series/${input.seriesSlug}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { parseAdDraft } from "@/lib/ads/draft";

export type CreateAdState = { error: string | null };

// Saves a draft only. Nothing is sent to Meta and nothing spends money.
export async function createAdDraft(_previous: CreateAdState, formData: FormData): Promise<CreateAdState> {
  const { brand, session } = await requireStaffBrandOrThrow();
  let draft;
  try {
    draft = parseAdDraft(formData);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not read the form." };
  }
  await prisma.adCampaign.create({
    data: { ...draft, brandId: brand.id, createdById: session.user.id },
  });
  revalidatePath("/ads");
  redirect("/ads");
}

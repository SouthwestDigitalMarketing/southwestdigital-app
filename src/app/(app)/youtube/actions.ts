"use server";

import { prisma } from "@/lib/prisma";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { revalidatePath } from "next/cache";

export async function updateYouTubeGoal(
  brandId: string,
  field: "monthlyViewsGoal" | "youtubeWatchPercentageGoal",
  value: number,
) {
  const { brand } = await requireStaffBrandOrThrow();
  if (brand.id !== brandId) throw new Error("Unauthorized");

  await prisma.brandTheme.update({
    where: { brandId },
    data: { [field]: value },
  });

  revalidatePath("/youtube");
}

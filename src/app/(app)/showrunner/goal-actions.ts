"use server";

import { prisma } from "@/lib/prisma";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { revalidatePath } from "next/cache";
import { showChannelBrand } from "@/lib/showrunner/channel-brand";

export async function updateYouTubeGoal(
  brandId: string,
  field: "monthlyViewsGoal" | "youtubeWatchPercentageGoal",
  value: number,
) {
  const { brand } = await requireStaffBrandOrThrow();
  // Overview shows The Real Estate Bookkeeper's goals from either Lochside brand (showChannelBrand).
  if ((await showChannelBrand(brand)).id !== brandId) throw new Error("Unauthorized");

  await prisma.brandTheme.update({
    where: { brandId },
    data: { [field]: value },
  });

  revalidatePath("/showrunner");
  revalidatePath("/showrunner/month");
}

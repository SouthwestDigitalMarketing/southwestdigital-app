"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MembershipStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function updateWebsiteGoal(brandId: string, value: number) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const membership = await prisma.brandMembership.findFirst({
    where: { brandId, userId: session.user.id, status: MembershipStatus.ACTIVE },
  });
  if (!membership) throw new Error("Unauthorized");

  await prisma.brandTheme.update({
    where: { brandId },
    data: { websiteEngagedSessionsGoal: value },
  });

  revalidatePath("/website");
}

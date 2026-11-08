"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { getMrrGoals } from "@/lib/dashboard/mrr-goals";

const DASHBOARD_GOAL_FIELDS = [
  "monthlyReviewRequestsGoal",
  "reviewOpenRateGoal",
  "reviewFiveStarRateGoal",
  "monthlyOffersSentGoal",
  "monthlyOffersAcceptedGoal",
  "monthlyMrrGoal",
  "leadMrrGoal",
] as const;

export type DashboardGoalField = (typeof DASHBOARD_GOAL_FIELDS)[number];

function isDashboardGoalField(value: string): value is DashboardGoalField {
  return DASHBOARD_GOAL_FIELDS.includes(value as DashboardGoalField);
}

export async function updateDashboardGoal(brandId: string, field: DashboardGoalField, value: number | null) {
  const { brand } = await requireStaffBrandOrThrow();
  if (brand.id !== brandId) throw new Error("Unauthorized");
  if (!isDashboardGoalField(field)) throw new Error("Invalid goal field.");
  if (value === null && field !== "monthlyMrrGoal" && field !== "leadMrrGoal") {
    throw new Error("Only MRR goals can be cleared.");
  }
  if ((field === "monthlyMrrGoal" || field === "leadMrrGoal") && !(await getMrrGoals(brandId)).available) {
    throw new Error("MRR targets are unavailable until the database update is applied.");
  }
  let nextValue: number | null = null;
  if (value !== null) {
    const parsed = Math.round(value);
    if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("Enter a goal greater than zero.");
    nextValue = field.endsWith("RateGoal") ? Math.min(100, parsed) : parsed;
  }

  await prisma.brandTheme.update({
    where: { brandId },
    data: { [field]: nextValue },
  });
  revalidatePath("/dashboard");
  revalidatePath("/settings");
}

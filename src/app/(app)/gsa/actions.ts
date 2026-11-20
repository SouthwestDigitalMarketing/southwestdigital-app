"use server";

import { revalidatePath } from "next/cache";
import { requireStaffBrand } from "@/lib/brands/staff";
import { GSA_STEPS, type GsaStep } from "@/lib/gsa/progress";
import { setGsaStep } from "@/lib/gsa/store";

/** Marks a GSA step done now, or clears it, from the GSA panel. */
export async function setGsaStepAction(engagementId: string, step: GsaStep, done: boolean) {
  const { dataContext } = await requireStaffBrand();
  if (!engagementId || !GSA_STEPS.includes(step)) throw new Error("Unknown GSA step.");
  await setGsaStep(dataContext, { engagementId, step, done });
  revalidatePath("/dashboard");
  revalidatePath("/contacts/[id]", "page");
  revalidatePath("/leads/[id]", "page");
}

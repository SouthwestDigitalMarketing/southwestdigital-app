"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import { changePlan, parsePlan } from "@/lib/van/plan";
import { starterPlan } from "@/lib/van/starter";

function reason(error: unknown): string {
  if (error instanceof z.ZodError) return "Check the fields: use valid, nonnegative numbers and a listed status.";
  if (error instanceof Error && !(error instanceof Prisma.PrismaClientKnownRequestError)) return error.message;
  return "That did not save. Try again.";
}

export async function startVanAction(mode: "shortlist" | "empty"): Promise<{ error?: string }> {
  const { dataContext } = await requireStaffBrandOrThrow();
  try {
    const shortlist = z.enum(["shortlist", "empty"]).parse(mode) === "shortlist";
    await withBrandDataTransaction(dataContext, (tx) => tx.vanHunt.upsert({
      where: { brandId: dataContext.brandId },
      create: { brandId: dataContext.brandId, plan: starterPlan(shortlist) as unknown as Prisma.InputJsonValue },
      // Double taps / another open tab must never replace an existing hunt.
      update: {},
    }));
  } catch (error) { return { error: reason(error) }; }
  revalidatePath("/van", "layout");
  return {};
}

/** Like Travel: authorize, establish the RLS context, lock, read and change one list item. */
export async function changeVanAction(change: unknown): Promise<{ error?: string }> {
  const { dataContext } = await requireStaffBrandOrThrow();
  try {
    await withBrandDataTransaction(dataContext, async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "VanHunt" WHERE "brandId" = ${dataContext.brandId} FOR UPDATE`;
      if (!locked.length) throw new Error("Start a van hunt first.");
      const row = await tx.vanHunt.findUniqueOrThrow({ where: { id: locked[0].id } });
      const plan = changePlan(parsePlan(row.plan), change);
      await tx.vanHunt.update({ where: { id: row.id }, data: { plan: plan as unknown as Prisma.InputJsonValue } });
    });
  } catch (error) { return { error: reason(error) }; }
  revalidatePath("/van", "layout");
  return {};
}

"use server";

import { revalidatePath } from "next/cache";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { showChannelBrand } from "@/lib/showrunner/channel-brand";
import { createBrandDataContext, withBrandDataTransaction } from "@/lib/tenancy/context";

/** Run review (Tom, 2026-11-25): ripley picks the request up within a minute and sends back a new scorecard. */
export async function requestReview(batch: string) {
  if (!/^[A-Za-z0-9-]{1,60}$/.test(batch)) throw new Error("Not a video.");
  const { brand: active, dataContext } = await requireStaffBrandOrThrow();
  const brand = await showChannelBrand(active);
  await withBrandDataTransaction(createBrandDataContext({ brandId: brand.id, actorUserId: dataContext.actorUserId }), (tx) =>
    tx.showrunnerVideoStatus.updateMany({ where: { brandId: brand.id, batch }, data: { reviewRequestedAt: new Date() } }),
  );
  revalidatePath(`/showrunner/editor/${batch}`);
}

import { requireStaffBrand } from "@/lib/brands/staff";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import { parsePlan, type VanPlan } from "@/lib/van/plan";

/** Every Van tab reads the same brand-scoped hunt; null until it is started. */
export async function loadVanPlan(): Promise<VanPlan | null> {
  const { dataContext } = await requireStaffBrand();
  const hunt = await withBrandDataTransaction(dataContext, (tx) =>
    tx.vanHunt.findUnique({ where: { brandId: dataContext.brandId }, select: { plan: true } }),
  );
  return hunt ? parsePlan(hunt.plan) : null;
}

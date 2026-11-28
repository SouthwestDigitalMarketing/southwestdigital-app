import { requireStaffBrand } from "@/lib/brands/staff";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import { parsePlan } from "@/lib/van/plan";
import { VanClient } from "./VanClient";

export const dynamic = "force-dynamic";

export default async function VanPage() {
  const { dataContext } = await requireStaffBrand();
  const hunt = await withBrandDataTransaction(dataContext, (tx) =>
    tx.vanHunt.findUnique({ where: { brandId: dataContext.brandId }, select: { plan: true } }),
  );
  return <VanClient plan={hunt ? parsePlan(hunt.plan) : null} />;
}

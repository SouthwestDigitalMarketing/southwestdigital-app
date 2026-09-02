import { prisma } from "@/lib/prisma";
import { requireStaffBrand } from "@/lib/brands/staff";
import { DiscountsCatalog } from "./DiscountsCatalog";

export default async function DiscountsPage() {
  const { brand } = await requireStaffBrand();
  const discounts = await prisma.brandDiscount.findMany({
    where: { brandId: brand.id },
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="p-8">
      <h1 className="sr-only">Discounts</h1>
      <section>
        <h2 className="text-lg font-semibold text-slate-900">Discounts</h2>
        <p className="mt-1 text-sm text-slate-500">
          Create a discount, then choose whether the lead sees it the first time they open the proposal. Leave that off to hold it and turn it on later.
        </p>
        <div className="mt-4">
          <DiscountsCatalog
            discounts={discounts.map((discount) => ({
              id: discount.id,
              name: discount.name,
              kind: discount.kind,
              percent: discount.percent,
              amount: Number(discount.amount),
              title: discount.title,
              details: discount.details,
              activationMode: discount.activationMode,
              activationDelayDays: discount.activationDelayDays,
              deadlineMode: discount.deadlineMode,
              durationDays: discount.durationDays,
              deadlineDate: discount.deadlineDate
                ? discount.deadlineDate.toISOString().slice(0, 10)
                : null,
              active: discount.active,
            }))}
          />
        </div>
      </section>
    </div>
  );
}

import "server-only";
import { notFound } from "next/navigation";
import { requireStaffBrand } from "@/lib/brands/staff";

export async function requireDonna() {
  const ctx = await requireStaffBrand();
  if (!ctx.isPlatformOperator || ctx.brand.slug !== "bookkeeping-conroe")
    notFound();
  return ctx;
}

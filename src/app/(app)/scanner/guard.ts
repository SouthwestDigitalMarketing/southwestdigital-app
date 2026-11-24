import "server-only";

import { notFound } from "next/navigation";
import { isLochsideBrandSlug } from "@/lib/brands/active-brand";
import { requireStaffBrand } from "@/lib/brands/staff";

/** The mail reviews show Tom's own mailbox: Lochside platform operators only,
 * like the header Scan button. */
export async function requireMailReviewPage() {
  const ctx = await requireStaffBrand();
  if (!ctx.isPlatformOperator || !isLochsideBrandSlug(ctx.brand.slug)) notFound();
  return ctx;
}

export function shortDate(value: string | null): string {
  if (!value) return "";
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) return "";
  return when.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" });
}

import { NextResponse } from "next/server";
import { requireAppBrand } from "@/lib/brands/staff";
import { showChannelBrand } from "@/lib/showrunner/channel-brand";
import { loadVideoCards } from "@/lib/showrunner/load";
import { productionItem } from "@/lib/showrunner/production";
import { createBrandDataContext } from "@/lib/tenancy/context";

export const dynamic = "force-dynamic";

/** The videos ripley is making now, for the production bar on every page (Tom, 2026-11-25). */
export async function GET() {
  const { brand: active, dataContext } = await requireAppBrand();
  const brand = await showChannelBrand(active);
  const cards = await loadVideoCards(createBrandDataContext({ brandId: brand.id, actorUserId: dataContext.actorUserId }));
  const videos = cards.flatMap((card) => productionItem(card) ?? []);
  return NextResponse.json({ videos }, { headers: { "Cache-Control": "no-store" } });
}

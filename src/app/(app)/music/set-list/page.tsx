import { requireStaffBrand } from "@/lib/brands/staff";
import { parseSongs } from "@/lib/music/setList";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import { SetListClient } from "./SetListClient";

export const dynamic = "force-dynamic";

/** Set list (Tom, 2026-11-28): the band's songs by part of the day, built from what people tell us. */
export default async function SetListPage() {
  const { dataContext } = await requireStaffBrand();
  const row = await withBrandDataTransaction(dataContext, (tx) =>
    tx.musicSetList.findUnique({ where: { brandId: dataContext.brandId }, select: { songs: true } }),
  );
  return <SetListClient songs={row ? parseSongs(row.songs) : null} />;
}

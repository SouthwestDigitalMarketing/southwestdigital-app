import { notFound } from "next/navigation";
import { requireStaffBrand } from "@/lib/brands/staff";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import { SECTION_KEYS, parsePlan, sectionFor, type SectionKey } from "@/lib/travel/plan";
import { ItemDetail } from "./ItemDetail";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string; section: string; id: string }> };

/** One option, stay, place, document... with room for everything (Tom, 2026-11-25). */
export default async function TravelItemPage({ params }: PageProps) {
  const { slug, section, id } = await params;
  if (!(SECTION_KEYS as readonly string[]).includes(section)) notFound();
  const key = section as SectionKey;
  const { dataContext } = await requireStaffBrand();
  const trip = await withBrandDataTransaction(dataContext, (tx) =>
    tx.trip.findUnique({
      where: { brandId_slug: { brandId: dataContext.brandId, slug } },
      select: { slug: true, title: true, plan: true },
    }),
  );
  if (!trip) notFound();
  const items = parsePlan(trip.plan).sections[key];
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) notFound();
  return (
    <ItemDetail
      key={JSON.stringify(items[index])}
      slug={trip.slug}
      tripTitle={trip.title}
      sectionKey={key}
      sectionTitle={sectionFor(key).title}
      item={items[index]}
      previousId={items[index - 1]?.id ?? null}
      nextId={items[index + 1]?.id ?? null}
      position={`${index + 1} of ${items.length}`}
    />
  );
}

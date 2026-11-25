import { notFound } from "next/navigation";
import { requireStaffBrand } from "@/lib/brands/staff";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import { SECTION_KEYS, optionTotal, parsePlan, pinFor, sectionFor, spotsFor, tripDays, type SectionKey } from "@/lib/travel/plan";
import { ItemDetail } from "./ItemDetail";
import { suggestionsFor } from "@/lib/travel/spots";

export const dynamic = "force-dynamic";
// "Add suggested spots" / "Find photos and pins" fetch photos and pins one by one (about 30-60 s).
export const maxDuration = 120;

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
      select: { slug: true, title: true, plan: true, startsOn: true, endsOn: true },
    }),
  );
  if (!trip) notFound();
  const plan = parsePlan(trip.plan);
  const days = tripDays(plan, trip);
  const items = plan.sections[key];
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
      total={key === "options" ? { days, amount: optionTotal(items[index], days) } : null}
      parent={(() => {
        if (key !== "spots") return null;
        const name = String(items[index].option ?? "").toLowerCase();
        const option = plan.sections.options.find((item) => String(item.place ?? "").toLowerCase() === name);
        return option ? { href: `/travel/${trip.slug}/options/${option.id}`, label: String(option.place) } : null;
      })()}
      dayLife={
        key === "options"
          ? {
              option: String(items[index].place ?? ""),
              optionPin: pinFor("options", items[index]),
              groups: spotsFor(plan, String(items[index].place ?? "")),
              suggestions: suggestionsFor(
                String(items[index].place ?? ""),
                plan.sections.spots
                  .filter((spot) => String(spot.option ?? "").toLowerCase() === String(items[index].place ?? "").toLowerCase())
                  .map((spot) => String(spot.name ?? "")),
              ).length,
            }
          : null
      }
    />
  );
}

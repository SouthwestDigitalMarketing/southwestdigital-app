import { notFound } from "next/navigation";
import { requireStaffBrand } from "@/lib/brands/staff";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import { TRIP_STATUSES, parsePlan, type TripStatus } from "@/lib/travel/plan";
import { TripClient } from "./TripClient";

export const dynamic = "force-dynamic";
// "Add suggested spots" / "Find photos and pins" fetch photos and pins one by one (about 30-60 s).
export const maxDuration = 120;

type PageProps = { params: Promise<{ slug: string }> };

export default async function TripPage({ params }: PageProps) {
  const { slug } = await params;
  const { dataContext } = await requireStaffBrand();
  const trip = await withBrandDataTransaction(dataContext, (tx) =>
    tx.trip.findUnique({ where: { brandId_slug: { brandId: dataContext.brandId, slug } } }),
  );
  if (!trip) notFound();
  const status: TripStatus = (TRIP_STATUSES as readonly string[]).includes(trip.status)
    ? (trip.status as TripStatus)
    : "planning";
  return (
    <TripClient
      slug={trip.slug}
      details={{
        title: trip.title,
        status,
        destination: trip.destination,
        startsOn: trip.startsOn,
        endsOn: trip.endsOn,
      }}
      plan={parsePlan(trip.plan)}
      today={new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date())}
    />
  );
}

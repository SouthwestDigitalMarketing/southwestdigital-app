import Link from "next/link";
import { requireStaffBrand } from "@/lib/brands/staff";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import { TRIP_STATUS_LABELS, budgetTotals, formatMoney, parsePlan, type TripStatus } from "@/lib/travel/plan";
import { createTripAction } from "./actions";

export const dynamic = "force-dynamic";

function dates(startsOn: string, endsOn: string) {
  if (!startsOn && !endsOn) return "Dates not set";
  return `${startsOn || "?"} to ${endsOn || "?"}`;
}

/** Travel (Tom, 2026-11-25): pick a trip to open its plan. */
export default async function TravelPage() {
  const { dataContext } = await requireStaffBrand();
  const trips = await withBrandDataTransaction(dataContext, (tx) =>
    tx.trip.findMany({
      where: { brandId: dataContext.brandId },
      orderBy: [{ startsOn: "desc" }, { createdAt: "desc" }],
    }),
  );

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Travel</h1>
      <p className="mt-1 text-sm text-slate-500">Each trip has one page with its budget, stays, places, itinerary and videos.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {trips.map((trip) => {
          const totals = budgetTotals(parsePlan(trip.plan));
          return (
            <Link
              key={trip.id}
              href={`/travel/${trip.slug}`}
              className="ui-focus-ring rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-400"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {TRIP_STATUS_LABELS[trip.status as TripStatus] ?? trip.status}
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{trip.title}</p>
              <p className="mt-1 text-sm text-slate-600">{trip.destination || "Place not picked yet"}</p>
              <p className="mt-1 text-sm text-slate-500">{dates(trip.startsOn, trip.endsOn)}</p>
              <p className="mt-3 text-sm text-slate-700">
                Budget {totals.planned ? formatMoney(totals.planned) : "not set"}
                {totals.actual ? ` · spent ${formatMoney(totals.actual)}` : ""}
              </p>
            </Link>
          );
        })}
        {trips.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
            No trips yet.
          </div>
        ) : null}
      </div>

      <div className="mt-8 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-end">
        <form action={createTripAction} className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-sm text-slate-700">
            New trip
            <input
              name="title"
              required
              maxLength={120}
              placeholder="e.g. Japan, spring 2027"
              className="ui-focus-ring rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </label>
          <button type="submit" className="ui-action-primary rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide">
            Add trip
          </button>
        </form>
        {trips.length === 0 ? (
          <form action={createTripAction}>
            <input type="hidden" name="starter" value="remote-months" />
            <button type="submit" className="ui-action-secondary rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide">
              Start from the two-months-abroad research
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

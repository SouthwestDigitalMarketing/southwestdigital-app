"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { airbnbSearchUrl, pinFor, sectionFor, type MapPin, type TripItem } from "@/lib/travel/plan";
import { ItemForm, card, ghost, newId, useChange } from "../../parts";
import { MapLegend, TripMap } from "../../TripMap";

const KIND_BLURBS: Record<string, string> = {
  "Neighborhood to stay": "Where to look for a monthly rental",
  Rental: "Rentals we are looking at",
  "Work spot": "Cafés and coworking to work from",
  Gym: "Olympic lifting",
  "Martial arts": "BJJ and Muay Thai",
  "Getting around": "Transit without a car",
  Music: "Blues, jams and open mics",
  Groceries: "Shake ingredients and food",
  Other: "Everything else",
};

/**
 * What a normal day would look like in one option (Tom, 2026-11-25: "I want to get a really good
 * idea of what day-to-day life would be"): photo rows by kind, Airbnb monthly searches, and a map.
 */
export function DayLife({
  slug,
  option,
  optionPin,
  groups,
  suggestions,
}: {
  slug: string;
  option: string;
  optionPin: MapPin | null;
  groups: Array<{ kind: string; spots: TripItem[] }>;
  suggestions: number;
}) {
  const section = sectionFor("spots");
  const router = useRouter();
  const [adding, setAdding] = useState<string | null>(null);
  const { pending, error, run } = useChange(slug);
  const spots = groups.flatMap((group) => group.spots);
  const pins = [optionPin, ...spots.map((spot) => pinFor("spots", spot))].filter((pin): pin is MapPin => pin !== null);
  const neighborhoods = groups.find((group) => group.kind === "Neighborhood to stay")?.spots ?? [];
  const rentalSearches = [
    ...neighborhoods.map((spot) => `${String(spot.name)}, ${option}`),
    option,
  ];

  return (
    <section className="mt-8" aria-labelledby="daylife-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="daylife-title" className="text-xl font-semibold text-slate-900">
            Day-to-day life
          </h2>
          <p className="text-sm text-slate-500">Where we would live, work, train, eat and play.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {suggestions > 0 ? (
            <button
              type="button"
              className={ghost}
              disabled={pending}
              onClick={() => run({ kind: "suggestSpots", option }, () => router.refresh())}
            >
              {pending ? "Adding spots and photos… about 30 seconds" : `Add suggested spots (${suggestions})`}
            </button>
          ) : null}
          {adding ? null : (
            <button type="button" className={ghost} onClick={() => setAdding(newId())}>
              Add a spot
            </button>
          )}
        </div>
      </div>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      {adding ? (
        <div className="mt-3">
          <ItemForm
            key={adding}
            section={section}
            item={{ id: adding, option, kind: "Work spot" }}
            pending={pending}
            onCancel={() => setAdding(null)}
            onSave={(next) =>
              run({ kind: "save", section: "spots", item: next }, () => {
                setAdding(null);
                router.refresh();
              })
            }
          />
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className={`${card} overflow-hidden p-2`}>
          <TripMap pins={pins} hrefFor={(pin) => `/travel/${slug}/${pin.section}/${pin.id}`} className="h-64 sm:h-80" zoom={12} />
          <div className="px-2 pb-2">
            <MapLegend sections={[...new Set(pins.map((pin) => pin.section))]} />
          </div>
        </div>
        <div className={`${card} flex flex-col justify-center p-5 sm:p-6`}>
          <p className="text-sm font-semibold text-slate-900">Find a monthly rental</p>
          <p className="mt-1 text-sm text-slate-500">Search Airbnb for a month at a time.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {rentalSearches.map((place) => (
              <a key={place} href={airbnbSearchUrl(place)} target="_blank" rel="noreferrer" className={ghost}>
                Airbnb · {place}
              </a>
            ))}
          </div>
        </div>
      </div>

      {spots.length === 0 && !adding ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          No spots yet for {option}. Add cafés, gyms, transit and music spots to see a normal day here.
        </p>
      ) : null}

      {groups.map((group) => (
        <div key={group.kind} className="mt-8">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-lg font-semibold tracking-tight text-slate-900">{group.kind}</h3>
            <span className="text-xs text-slate-500">{group.spots.length} {group.spots.length === 1 ? "place" : "places"}</span>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">{KIND_BLURBS[group.kind] ?? ""}</p>
          <div className="-mx-4 mt-2 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
            {group.spots.map((spot) => (
              <SpotCard key={spot.id} slug={slug} spot={spot} />
            ))}
          </div>
        </div>
      ))}

    </section>
  );
}

function SpotCard({ slug, spot }: { slug: string; spot: TripItem }) {
  const photo = typeof spot.photo === "string" && spot.photo ? spot.photo : null;
  return (
    <Link
      href={`/travel/${slug}/spots/${spot.id}`}
      className={`${card} ui-focus-ring w-64 shrink-0 snap-start overflow-hidden rounded-2xl shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:w-auto`}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt={String(spot.name ?? "")}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="aspect-[4/3] w-full bg-slate-100 object-cover"
        />
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center bg-slate-100 text-xs text-slate-400">No photo yet</div>
      )}
      <div className="p-3">
        <p className="font-semibold text-slate-900">{String(spot.name ?? "")}</p>
        {spot.area ? <p className="text-xs text-slate-500">{String(spot.area)}</p> : null}
        {spot.why ? <p className="mt-1 line-clamp-3 text-sm text-slate-700">{String(spot.why)}</p> : null}
      </div>
    </Link>
  );
}

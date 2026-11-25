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

      <div className={`${card} mt-4 p-4`}>
        <p className="text-sm font-semibold text-slate-900">Find a monthly rental</p>
        <p className="mt-0.5 text-xs text-slate-500">Opens Airbnb&apos;s own search for monthly stays.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {rentalSearches.map((place) => (
            <a key={place} href={airbnbSearchUrl(place)} target="_blank" rel="noreferrer" className={ghost}>
              Airbnb: {place}
            </a>
          ))}
        </div>
      </div>

      {spots.length === 0 && !adding ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          No spots yet for {option}. Add cafés, gyms, transit and music spots to see a normal day here.
        </p>
      ) : null}

      {groups.map((group) => (
        <div key={group.kind} className="mt-6">
          <h3 className="text-base font-semibold text-slate-900">{group.kind}</h3>
          <p className="text-xs text-slate-500">{KIND_BLURBS[group.kind] ?? ""}</p>
          <div className="-mx-4 mt-2 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
            {group.spots.map((spot) => (
              <SpotCard key={spot.id} slug={slug} spot={spot} />
            ))}
          </div>
        </div>
      ))}

      {pins.length ? (
        <div className="mt-6">
          <h3 className="text-base font-semibold text-slate-900">Map of {option}</h3>
          <div className="mt-2">
            <TripMap pins={pins} hrefFor={(pin) => `/travel/${slug}/${pin.section}/${pin.id}`} zoom={12} />
            <MapLegend sections={[...new Set(pins.map((pin) => pin.section))]} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SpotCard({ slug, spot }: { slug: string; spot: TripItem }) {
  const photo = typeof spot.photo === "string" && spot.photo ? spot.photo : null;
  return (
    <Link
      href={`/travel/${slug}/spots/${spot.id}`}
      className={`${card} ui-focus-ring w-64 shrink-0 snap-start overflow-hidden hover:border-slate-400 sm:w-auto`}
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

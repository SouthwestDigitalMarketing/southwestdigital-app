"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  AUTO_PHOTO_SECTIONS,
  SECTIONS,
  TRIP_STATUSES,
  TRIP_STATUS_LABELS,
  budgetTotals,
  documentWarnings,
  documentsReady,
  formatMoney,
  itemsWithoutPhoto,
  itemsWithoutPin,
  mapPins,
  OPTION_SORTS,
  optionTotal,
  sortOptions,
  tripDays,
  type MapPin,
  type OptionSort,
  type Section,
  type SectionKey,
  type TripItem,
  type TripPlan,
  type TripStatus,
} from "@/lib/travel/plan";
import { deleteTripAction } from "../actions";
import { ItemForm, ItemPhoto, card, danger, ghost, inputClass, newId, primary, shownValue, useChange } from "./parts";
import { MapLegend, TripMap } from "./TripMap";

type Details = { title: string; status: TripStatus; destination: string; startsOn: string; endsOn: string };

const MAP_KEYS: SectionKey[] = ["options", "stays", "places"];

export function itemHref(slug: string, section: SectionKey, id: string) {
  return `/travel/${slug}/${section}/${id}`;
}

export function TripClient({
  slug,
  details,
  plan,
  today,
}: {
  slug: string;
  details: Details;
  plan: TripPlan;
  today: string;
}) {
  const totals = budgetTotals(plan);
  const docs = documentsReady(plan);
  const warnings = documentWarnings(plan, details, today);
  const counts = (key: SectionKey) => plan.sections[key].length;
  const pins = mapPins(plan);
  const days = tripDays(plan, details);
  const tiles = [
    { label: "Budget planned", value: totals.planned ? formatMoney(totals.planned) : "Not set" },
    { label: "Spent so far", value: formatMoney(totals.actual) || "$0" },
    { label: "Booked legs and stays", value: formatMoney(totals.booked) || "$0" },
    { label: "Documents ready", value: `${docs.ready} of ${docs.total}` },
    {
      label: "Needs covered",
      value: `${plan.sections.needs.filter((item) => item.covered === true).length} of ${counts("needs")}`,
    },
    {
      label: "Home checklist",
      value: `${plan.sections.home.filter((item) => item.done === true).length} of ${counts("home")} done`,
    },
  ];

  return (
    <div className="p-4 sm:p-8">
      <Link href="/travel" className="text-sm text-slate-500 hover:text-slate-800">
        All trips
      </Link>
      <TripHeader slug={slug} details={details} summary={plan.summary} days={plan.days} />

      {warnings.length ? (
        <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Check these documents</p>
          <ul className="mt-1 list-disc pl-5">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          <a href="#documents" className="mt-2 inline-block underline">
            Go to Documents
          </a>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((tile) => (
          <div key={tile.label} className={`${card} p-4`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{tile.label}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{tile.value}</p>
          </div>
        ))}
      </div>

      <section id="map" className="mt-6 scroll-mt-20" aria-labelledby="map-title">
        <h2 id="map-title" className="text-lg font-semibold text-slate-900">
          Map
        </h2>
        <div className="mt-2">
          <TripMap pins={pins} hrefFor={(pin: MapPin) => itemHref(slug, pin.section, pin.id)} />
          <MapLegend sections={MAP_KEYS.filter((key) => pins.some((pin) => pin.section === key))} />
        </div>
      </section>

      <nav aria-label="Trip sections" className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {SECTIONS.map((section) => (
          <a
            key={section.key}
            href={`#${section.key}`}
            className="ui-focus-ring shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-400"
          >
            {section.title} <span className="text-slate-400">{counts(section.key)}</span>
          </a>
        ))}
      </nav>

      {SECTIONS.map((section) => (
        <SectionBlock
          key={section.key}
          slug={slug}
          section={section}
          items={plan.sections[section.key]}
          days={days}
          missing={
            (AUTO_PHOTO_SECTIONS.has(section.key) ? itemsWithoutPhoto(plan, section.key).length : 0) +
            itemsWithoutPin(plan, section.key).length
          }
        />
      ))}

      <DeleteTrip slug={slug} />
    </div>
  );
}

function TripHeader({
  slug,
  details,
  summary,
  days,
}: {
  slug: string;
  details: Details;
  summary: string;
  days: number;
}) {
  const [editing, setEditing] = useState(false);
  const { pending, error, run } = useChange(slug);
  const dates =
    details.startsOn || details.endsOn ? `${details.startsOn || "?"} to ${details.endsOn || "?"}` : `Dates not set · ${days} days`;

  if (!editing) {
    return (
      <div className="mt-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">{details.title}</h1>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            {TRIP_STATUS_LABELS[details.status]}
          </span>
          <button type="button" className={ghost} onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {details.destination || "Place not picked yet"} · {dates}
        </p>
        {summary ? <p className="mt-3 max-w-3xl whitespace-pre-line text-sm text-slate-700">{summary}</p> : null}
      </div>
    );
  }

  return (
    <form
      className={`${card} mt-2 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2`}
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        run(
          {
            kind: "details",
            details: {
              title: form.get("title"),
              status: form.get("status"),
              destination: form.get("destination"),
              startsOn: form.get("startsOn"),
              endsOn: form.get("endsOn"),
              summary: form.get("summary"),
              days: form.get("days"),
            },
          },
          () => setEditing(false),
        );
      }}
    >
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Trip name
        <input name="title" required maxLength={120} defaultValue={details.title} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Status
        <select name="status" defaultValue={details.status} className={inputClass}>
          {TRIP_STATUSES.map((status) => (
            <option key={status} value={status}>
              {TRIP_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Where
        <input name="destination" maxLength={120} defaultValue={details.destination} className={inputClass} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Starts
          <input type="date" name="startsOn" defaultValue={details.startsOn} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Ends
          <input type="date" name="endsOn" defaultValue={details.endsOn} className={inputClass} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm text-slate-700">
        Length in days (used until dates are set)
        <input type="number" name="days" min={1} max={365} required defaultValue={days} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-700 sm:col-span-2">
        What this trip is
        <textarea name="summary" rows={3} maxLength={5000} defaultValue={summary} className={inputClass} />
      </label>
      {error ? <p className="text-sm text-red-700 sm:col-span-2">{error}</p> : null}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={pending} className={primary}>
          Save
        </button>
        <button type="button" className={ghost} onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function SectionBlock({
  slug,
  section,
  items,
  days,
  missing,
}: {
  slug: string;
  section: Section;
  items: TripItem[];
  days: number;
  missing: number;
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const [sort, setSort] = useState<OptionSort>("mine");
  const isOptions = section.key === "options";
  const shown = isOptions ? sortOptions(items, sort, days) : items;
  const { pending, error, run } = useChange(slug);
  const totals =
    section.key === "budget"
      ? {
          planned: items.reduce((sum, item) => sum + (typeof item.planned === "number" ? item.planned : 0), 0),
          actual: items.reduce((sum, item) => sum + (typeof item.actual === "number" ? item.actual : 0), 0),
        }
      : null;

  return (
    <section id={section.key} className="mt-8 scroll-mt-20" aria-labelledby={`${section.key}-title`}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id={`${section.key}-title`} className="text-lg font-semibold text-slate-900">
            {section.title}
          </h2>
          <p className="text-sm text-slate-500">{section.blurb}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {section.key === "needs" && items.length === 0 ? (
            <button type="button" className={ghost} disabled={pending} onClick={() => run({ kind: "standingNeeds" })}>
              Add my usual needs
            </button>
          ) : null}
          {missing > 0 ? (
            <button type="button" className={ghost} disabled={pending} onClick={() => run({ kind: "fill", section: section.key })}>
              {pending ? "Looking…" : "Find photos and pins"}
            </button>
          ) : null}
          {adding ? null : (
            <button type="button" className={ghost} onClick={() => setAdding(newId())}>
              Add {section.itemLabel}
            </button>
          )}
        </div>
      </div>
      {totals ? (
        <p className="mt-2 text-sm text-slate-700">
          Planned <strong>{formatMoney(Math.round(totals.planned * 100) / 100)}</strong> · Actual{" "}
          <strong>{formatMoney(Math.round(totals.actual * 100) / 100)}</strong>
        </p>
      ) : null}
      {isOptions && items.length > 1 ? (
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
          Sort
          <select value={sort} onChange={(event) => setSort(event.target.value as OptionSort)} className={`${inputClass} w-auto`}>
            {(Object.keys(OPTION_SORTS) as OptionSort[]).map((key) => (
              <option key={key} value={key}>
                {OPTION_SORTS[key]}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((item) => (
          <ItemCard
            // Keyed on the saved values so a checkbox's instant tick resets once the server answers.
            key={`${item.id}:${JSON.stringify(item)}`}
            slug={slug}
            section={section}
            item={item}
            total={isOptions ? optionTotal(item, days) : null}
            days={days}
            pending={pending}
            onToggle={(key, value) => run({ kind: "save", section: section.key, item: { ...item, [key]: value } })}
          />
        ))}
        {items.length === 0 && !adding ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Nothing here yet.
          </p>
        ) : null}
      </div>
      {adding ? (
        <div className="mt-3">
          <ItemForm
            key={adding}
            section={section}
            item={{ id: adding }}
            pending={pending}
            onCancel={() => setAdding(null)}
            onSave={(next) => run({ kind: "save", section: section.key, item: next }, () => setAdding(null))}
          />
        </div>
      ) : null}
    </section>
  );
}

/** A short card: photo, name, a few facts. The whole card opens the item's own page. */
function ItemCard({
  slug,
  section,
  item,
  total,
  days,
  pending,
  onToggle,
}: {
  slug: string;
  section: Section;
  item: TripItem;
  total: number | null;
  days: number;
  pending: boolean;
  onToggle: (key: string, value: boolean) => void;
}) {
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const facts = section.summary.flatMap((key) => {
    const field = section.fields.find((candidate) => candidate.key === key);
    const shown = field ? shownValue(field, item[key] ?? null) : null;
    return field && shown !== null ? [{ field, shown }] : [];
  });
  const checks = section.fields.filter((field) => field.type === "check");
  return (
    <div className={`${card} relative overflow-hidden transition hover:border-slate-400`}>
      <ItemPhoto item={item} section={section} />
      <div className="p-4">
        <Link
          href={itemHref(slug, section.key, item.id)}
          className="ui-focus-ring font-semibold text-slate-900 after:absolute after:inset-0 after:content-['']"
        >
          {String(item[section.heading] ?? "")}
        </Link>
        {total !== null ? (
          <p className="mt-1 text-sm text-slate-700">
            Total for {days} days: <strong className="text-base text-slate-900">{formatMoney(total)}</strong>
          </p>
        ) : null}
        {facts.length ? (
          <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
            {facts.map(({ field, shown }) => (
              <div key={field.key}>
                <dt className="inline text-slate-500">{field.label}: </dt>
                <dd className="inline text-slate-800">{shown}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {checks.length ? (
          <div className="relative z-10 mt-2 flex flex-wrap gap-3">
            {checks.map((field) => (
              <label key={field.key} className="flex items-center gap-1.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={ticked[field.key] ?? item[field.key] === true}
                  disabled={pending}
                  onChange={(event) => {
                    const value = event.target.checked;
                    setTicked((current) => ({ ...current, [field.key]: value }));
                    onToggle(field.key, value);
                  }}
                />
                {field.label}
              </label>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DeleteTrip({ slug }: { slug: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <div className="mt-12 border-t border-slate-200 pt-6">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-slate-700">Delete this trip and everything on its page?</p>
          <button
            type="button"
            className={danger}
            disabled={pending}
            onClick={() => startTransition(() => deleteTripAction(slug))}
          >
            Delete trip
          </button>
          <button type="button" className={ghost} onClick={() => setConfirming(false)}>
            Keep it
          </button>
        </div>
      ) : (
        <button type="button" className={ghost} onClick={() => setConfirming(true)}>
          Delete trip
        </button>
      )}
    </div>
  );
}

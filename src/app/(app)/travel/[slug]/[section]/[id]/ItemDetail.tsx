"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatMoney, pinFor, sectionFor, visibleFields, type MapPin, type SectionKey, type TripItem } from "@/lib/travel/plan";
import { ItemForm, ItemPhoto, card, danger, ghost, shownValue, useChange } from "../../parts";
import { TripMap } from "../../TripMap";
import { DayLife } from "./DayLife";

export function ItemDetail({
  slug,
  tripTitle,
  sectionKey,
  sectionTitle,
  item,
  previousId,
  nextId,
  position,
  total,
  parent,
  dayLife,
}: {
  slug: string;
  tripTitle: string;
  sectionKey: SectionKey;
  sectionTitle: string;
  item: TripItem;
  previousId: string | null;
  nextId: string | null;
  position: string;
  total: { days: number; amount: number | null } | null;
  parent: { href: string; label: string } | null;
  dayLife: {
    option: string;
    optionPin: MapPin | null;
    groups: Array<{ kind: string; spots: TripItem[] }>;
    suggestions: number;
  } | null;
}) {
  const section = sectionFor(sectionKey);
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const { pending, error, run } = useChange(slug);
  const back = `/travel/${slug}#${sectionKey}`;
  const fields = visibleFields(section).filter((field) => field.key !== section.heading && field.type !== "check" && field.type !== "photo");
  const filled = fields.flatMap((field) => {
    const shown = shownValue(field, item[field.key] ?? null);
    return shown === null ? [] : [{ field, shown }];
  });
  const empty = fields.filter((field) => shownValue(field, item[field.key] ?? null) === null);
  const checks = section.fields.filter((field) => field.type === "check");
  const pin = pinFor(sectionKey, item);
  const pins = pin ? [pin] : [];
  const neighbour = (id: string | null, label: string) =>
    id ? (
      <Link href={`/travel/${slug}/${sectionKey}/${id}`} className={ghost}>
        {label}
      </Link>
    ) : (
      <span className={`${ghost} opacity-40`} aria-disabled="true">
        {label}
      </span>
    );

  return (
    <div className="p-4 sm:p-8">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
        <Link href="/travel" className="hover:text-slate-800">
          Travel
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={`/travel/${slug}`} className="hover:text-slate-800">
          {tripTitle}
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={back} className="hover:text-slate-800">
          {sectionTitle}
        </Link>
        {parent ? (
          <>
            <span aria-hidden="true">·</span>
            <Link href={parent.href} className="font-semibold text-slate-700 hover:text-slate-900">
              Back to {parent.label}
            </Link>
          </>
        ) : null}
      </nav>

      <div className={`${card} mt-3 overflow-hidden`}>
        <ItemPhoto item={item} section={section} tall />
        <div className="p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{String(item[section.heading] ?? "")}</h1>
            <div className="flex items-center gap-2">
              {neighbour(previousId, "← Previous")}
              <span className="text-xs text-slate-500">{position}</span>
              {neighbour(nextId, "Next →")}
            </div>
          </div>

          {total && total.amount !== null ? (
            <p className="mt-2 text-sm text-slate-700">
              Total for {total.days} days (round trip + per month):{" "}
              <strong className="text-lg text-slate-900">{formatMoney(total.amount)}</strong>
            </p>
          ) : null}

          {editing ? (
            <div className="mt-4">
              <ItemForm
                section={section}
                item={item}
                pending={pending}
                onCancel={() => setEditing(false)}
                onSave={(next) => run({ kind: "save", section: sectionKey, item: next }, () => {
                  setEditing(false);
                  router.refresh();
                })}
              />
            </div>
          ) : (
            <>
              {checks.length ? (
                <div className="mt-3 flex flex-wrap gap-4">
                  {checks.map((field) => (
                    <label key={field.key} className="flex items-center gap-1.5 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={ticked[field.key] ?? item[field.key] === true}
                        disabled={pending}
                        onChange={(event) => {
                          const value = event.target.checked;
                          setTicked((current) => ({ ...current, [field.key]: value }));
                          run({ kind: "save", section: sectionKey, item: { ...item, [field.key]: value } }, () => router.refresh());
                        }}
                      />
                      {field.label}
                    </label>
                  ))}
                </div>
              ) : null}
              <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                {filled.map(({ field, shown }) => (
                  <div key={field.key} className={field.type === "long" ? "sm:col-span-2" : undefined}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{field.label}</dt>
                    <dd className={`mt-1 text-sm text-slate-800 ${field.type === "long" ? "whitespace-pre-line leading-relaxed" : ""}`}>
                      {shown}
                    </dd>
                  </div>
                ))}
              </dl>
              {empty.length ? (
                <p className="mt-4 text-xs text-slate-500">Not filled in yet: {empty.map((field) => field.label).join(", ")}</p>
              ) : null}
            </>
          )}
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

          {!editing ? (
            <div className="mt-6 flex flex-wrap gap-2">
              <button type="button" className={ghost} disabled={pending} onClick={() => setEditing(true)}>
                Edit
              </button>
              {confirming ? (
                <>
                  <button
                    type="button"
                    className={danger}
                    disabled={pending}
                    onClick={() => run({ kind: "remove", section: sectionKey, id: item.id }, () => router.push(back))}
                  >
                    Really remove
                  </button>
                  <button type="button" className={ghost} onClick={() => setConfirming(false)}>
                    Keep
                  </button>
                </>
              ) : (
                <button type="button" className={ghost} disabled={pending} onClick={() => setConfirming(true)}>
                  Remove
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {dayLife ? <DayLife slug={slug} {...dayLife} /> : null}

      {!dayLife && section.fields.some((field) => field.type === "coordinate") ? (
        <section className="mt-6" aria-label="Where it is">
          <TripMap pins={pins} className="h-56 sm:h-72" zoom={11} />
        </section>
      ) : null}
    </div>
  );
}

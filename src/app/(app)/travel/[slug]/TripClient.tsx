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
  type Field,
  type ItemValue,
  type Section,
  type SectionKey,
  type TripItem,
  type TripPlan,
  type TripStatus,
} from "@/lib/travel/plan";
import { changeTripAction, deleteTripAction } from "../actions";

type Details = { title: string; status: TripStatus; destination: string; startsOn: string; endsOn: string };

const inputClass =
  "ui-focus-ring w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";
const ghost =
  "ui-action-ghost rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide disabled:opacity-50";
const danger =
  "ui-action-danger rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide disabled:opacity-50";
const primary =
  "ui-action-primary rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide disabled:opacity-50";
const card = "rounded-xl border border-slate-200 bg-white";

function message(error: unknown) {
  if (error instanceof Error && error.message && !error.message.startsWith("[")) return error.message;
  return "That did not save. Check the fields and try again.";
}

function useChange(slug: string) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (change: Parameters<typeof changeTripAction>[1], after?: () => void) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await changeTripAction(slug, change);
        if (result.error) setError(result.error);
        else after?.();
      } catch (caught) {
        setError(message(caught));
      }
    });
  };
  return { pending, error, run };
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
      <TripHeader slug={slug} details={details} summary={plan.summary} />

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
          missingPhotos={AUTO_PHOTO_SECTIONS.has(section.key) ? itemsWithoutPhoto(plan, section.key).length : 0}
        />
      ))}

      <DeleteTrip slug={slug} />
    </div>
  );
}

function TripHeader({ slug, details, summary }: { slug: string; details: Details; summary: string }) {
  const [editing, setEditing] = useState(false);
  const { pending, error, run } = useChange(slug);
  const dates = details.startsOn || details.endsOn ? `${details.startsOn || "?"} to ${details.endsOn || "?"}` : "Dates not set";

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

/** A v4 UUID; crypto.randomUUID is missing on plain-http pages (local previews over Tailscale). */
function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function SectionBlock({
  slug,
  section,
  items,
  missingPhotos,
}: {
  slug: string;
  section: Section;
  items: TripItem[];
  missingPhotos: number;
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const { pending, error, run } = useChange(slug);
  const isBudget = section.key === "budget";
  const totals = isBudget
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
          {missingPhotos > 0 ? (
            <button
              type="button"
              className={ghost}
              disabled={pending}
              onClick={() => run({ kind: "photos", section: section.key })}
            >
              {pending ? "Finding photos…" : "Find photos"}
            </button>
          ) : null}
          {adding ? null : (
            <button type="button" className={ghost} onClick={() => { setEditing(null); setAdding(newId()); }}>
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
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {items.map((item, index) =>
          editing === item.id ? (
            <ItemForm
              key={item.id}
              section={section}
              item={item}
              pending={pending}
              onCancel={() => setEditing(null)}
              onSave={(next) => run({ kind: "save", section: section.key, item: next }, () => setEditing(null))}
            />
          ) : (
            <ItemCard
              // Keyed on the saved values so a checkbox's instant tick resets once the server answers.
              key={`${item.id}:${JSON.stringify(item)}`}
              section={section}
              item={item}
              pending={pending}
              first={index === 0}
              last={index === items.length - 1}
              onEdit={() => { setAdding(null); setEditing(item.id); }}
              onToggle={(key, value) => run({ kind: "save", section: section.key, item: { ...item, [key]: value } })}
              onMove={(direction) => run({ kind: "move", section: section.key, id: item.id, direction })}
              onRemove={() => run({ kind: "remove", section: section.key, id: item.id })}
            />
          ),
        )}
        {adding ? (
          <ItemForm
            key={adding}
            section={section}
            item={{ id: adding }}
            pending={pending}
            onCancel={() => setAdding(null)}
            onSave={(next) => run({ kind: "save", section: section.key, item: next }, () => setAdding(null))}
          />
        ) : null}
        {items.length === 0 && !adding ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Nothing here yet.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function shownValue(field: Field, value: ItemValue) {
  if (field.type === "money") return typeof value === "number" ? formatMoney(value) : null;
  if (typeof value !== "string" || value === "") return null;
  if (field.type === "url") {
    let host = value;
    try {
      host = new URL(value).hostname.replace(/^www\./, "");
    } catch {}
    return (
      <a href={value} target="_blank" rel="noreferrer" className="text-sky-700 underline break-all">
        {host}
      </a>
    );
  }
  return value;
}

function ItemCard({
  section,
  item,
  pending,
  first,
  last,
  onEdit,
  onToggle,
  onMove,
  onRemove,
}: {
  section: Section;
  item: TripItem;
  pending: boolean;
  first: boolean;
  last: boolean;
  onEdit: () => void;
  onToggle: (key: string, value: boolean) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const rest = section.fields.filter(
    (field) => field.key !== section.heading && field.type !== "check" && field.type !== "photo",
  );
  const checks = section.fields.filter((field) => field.type === "check");
  const photo = typeof item.photo === "string" && item.photo ? item.photo : null;
  return (
    <div className={`${card} overflow-hidden`}>
      {photo ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt={String(item[section.heading] ?? "")}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="aspect-[16/9] w-full bg-slate-100 object-cover"
          />
          {/wikimedia\.org$/.test(hostOf(photo)) ? (
            <span className="absolute bottom-1 right-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
              Wikimedia Commons
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-slate-900">{String(item[section.heading] ?? "")}</p>
          <div className="flex shrink-0 gap-1">
            <button type="button" aria-label="Move up" disabled={pending || first} className={ghost} onClick={() => onMove(-1)}>
              ↑
            </button>
            <button type="button" aria-label="Move down" disabled={pending || last} className={ghost} onClick={() => onMove(1)}>
              ↓
            </button>
          </div>
        </div>
        <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          {rest.map((field) => {
            const shown = shownValue(field, item[field.key] ?? null);
            if (shown === null) return null;
            return (
              <div key={field.key} className={field.type === "long" ? "sm:col-span-2" : undefined}>
                <dt className="inline text-slate-500">{field.label}: </dt>
                <dd className={`inline text-slate-800 ${field.type === "long" ? "whitespace-pre-line" : ""}`}>{shown}</dd>
              </div>
            );
          })}
        </dl>
        <div className="mt-3 flex flex-wrap items-center gap-2">
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
          <span className="flex-1" />
          <button type="button" className={ghost} disabled={pending} onClick={onEdit}>
            Edit
          </button>
          {confirming ? (
            <>
              <button type="button" className={danger} disabled={pending} onClick={onRemove}>
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
      </div>
    </div>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function ItemForm({
  section,
  item,
  pending,
  onSave,
  onCancel,
}: {
  section: Section;
  item: Partial<TripItem> & { id: string };
  pending: boolean;
  onSave: (item: Record<string, ItemValue>) => void;
  onCancel: () => void;
}) {
  return (
    <form
      className={`${card} grid grid-cols-1 gap-3 p-4 sm:grid-cols-2`}
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const next: Record<string, ItemValue> = { id: item.id };
        for (const field of section.fields) {
          const raw = form.get(field.key);
          if (field.type === "check") next[field.key] = raw === "on";
          else if (field.type === "money") {
            const text = String(raw ?? "").replace(/[$,\s]/g, "");
            next[field.key] = text === "" ? null : Number(text);
          } else next[field.key] = String(raw ?? "");
        }
        onSave(next);
      }}
    >
      {section.fields.map((field) => (
        <FieldInput key={field.key} field={field} value={item[field.key] ?? null} required={field.key === section.heading} />
      ))}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={pending} className={primary}>
          Save
        </button>
        <button type="button" className={ghost} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function FieldInput({ field, value, required }: { field: Field; value: ItemValue; required: boolean }) {
  const text = typeof value === "string" ? value : "";
  if (field.type === "check") {
    return (
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name={field.key} defaultChecked={value === true} />
        {field.label}
      </label>
    );
  }
  let control;
  switch (field.type) {
    case "long":
      control = <textarea name={field.key} rows={3} maxLength={5000} defaultValue={text} className={inputClass} />;
      break;
    case "choice":
      control = (
        <select name={field.key} defaultValue={text} className={inputClass}>
          <option value="">Pick one</option>
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
      break;
    case "money":
      control = (
        <input
          name={field.key}
          inputMode="decimal"
          placeholder="$0"
          defaultValue={typeof value === "number" ? String(value) : ""}
          className={inputClass}
        />
      );
      break;
    case "date":
      control = <input type="date" name={field.key} defaultValue={text} className={inputClass} />;
      break;
    case "url":
      control = <input type="url" name={field.key} placeholder="https://" defaultValue={text} className={inputClass} />;
      break;
    case "photo":
      control = (
        <input type="url" name={field.key} placeholder="Leave blank to find one" defaultValue={text} className={inputClass} />
      );
      break;
    default:
      control = <input name={field.key} required={required} maxLength={200} defaultValue={text} className={inputClass} />;
  }
  return (
    <label className={`flex flex-col gap-1 text-sm text-slate-700 ${field.type === "long" ? "sm:col-span-2" : ""}`}>
      {field.label}
      {control}
    </label>
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

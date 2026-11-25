"use client";

import { useState, useTransition } from "react";
import { formatHours, formatMoney, visibleFields, type Field, type ItemValue, type Section, type TripItem } from "@/lib/travel/plan";
import { changeTripAction } from "../actions";

/** Pieces shared by the trip page and an item's own page. */
export const inputClass =
  "ui-focus-ring w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";
export const ghost =
  "ui-action-ghost rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide disabled:opacity-50";
export const danger =
  "ui-action-danger rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide disabled:opacity-50";
export const primary =
  "ui-action-primary rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide disabled:opacity-50";
export const card = "rounded-xl border border-slate-200 bg-white";

function message(error: unknown) {
  if (error instanceof Error && error.message && !error.message.startsWith("[")) return error.message;
  return "That did not save. Check the fields and try again.";
}

export function useChange(slug: string) {
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

/** A v4 UUID; crypto.randomUUID is missing on plain-http pages (local previews over Tailscale). */
export function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function shownValue(field: Field, value: ItemValue) {
  if (field.type === "money") return typeof value === "number" ? formatMoney(value) : null;
  if (field.type === "hours") return typeof value === "number" ? formatHours(value) : null;
  if (typeof value !== "string" || value === "") return null;
  if (field.type === "url" || field.type === "photo") {
    return (
      <a href={value} target="_blank" rel="noreferrer" className="break-all text-sky-700 underline">
        {hostOf(value).replace(/^www\./, "") || value}
      </a>
    );
  }
  return value;
}

export function ItemPhoto({ item, section, tall = false }: { item: TripItem; section: Section; tall?: boolean }) {
  const photo = typeof item.photo === "string" && item.photo ? item.photo : null;
  if (!photo) return null;
  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo}
        alt={String(item[section.heading] ?? "")}
        loading="lazy"
        referrerPolicy="no-referrer"
        className={`${tall ? "aspect-[4/3] sm:aspect-[21/9]" : "aspect-[16/9]"} w-full bg-slate-100 object-cover`}
      />
      {/wikimedia\.org$/.test(hostOf(photo)) ? (
        <span className="absolute bottom-1 right-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
          Wikimedia Commons
        </span>
      ) : null}
    </div>
  );
}

export function ItemForm({
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
  const fields = visibleFields(section);
  return (
    <form
      className={`${card} grid grid-cols-1 gap-3 p-4 sm:grid-cols-2`}
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const next: Record<string, ItemValue> = { id: item.id };
        for (const field of fields) {
          const raw = form.get(field.key);
          if (field.type === "check") next[field.key] = raw === "on";
          else if (field.type === "money" || field.type === "hours") {
            const text = String(raw ?? "").replace(/[$,\s]/g, "");
            next[field.key] = text === "" ? null : Number(text);
          } else next[field.key] = String(raw ?? "");
        }
        onSave(next);
      }}
    >
      {fields.map((field) => (
        <FieldInput key={field.key} field={field} value={item[field.key] ?? null} required={field.key === section.heading} />
      ))}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={pending} className={primary}>
          {pending ? "Saving…" : "Save"}
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
    case "hours":
      control = (
        <input
          type="number"
          name={field.key}
          step="0.5"
          min="-24"
          max="24"
          placeholder="0 = same time, 15 = 15 hours ahead"
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

import { z } from "zod";

/**
 * Travel (Tom, 2026-11-25): one page per trip, "the Bible for that trip". Each trip keeps its
 * plan as lists (budget, getting there, stays, places, itinerary, entry rules, home checklist,
 * options, videos). Every list is described here once; the page and the server action both use it.
 */

export const TRIP_STATUSES = ["idea", "planning", "booked", "underway", "done"] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];
export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  idea: "Idea",
  planning: "Planning",
  booked: "Booked",
  underway: "Underway",
  done: "Done",
};

export const DOCUMENT_STATUSES = ["Need it", "Applied", "Have it", "Not needed"] as const;

export type FieldType = "text" | "long" | "money" | "date" | "url" | "check" | "choice";
export type Field = { key: string; label: string; type: FieldType; options?: readonly string[] };
export type SectionKey =
  | "options"
  | "documents"
  | "budget"
  | "travel"
  | "stays"
  | "places"
  | "itinerary"
  | "entry"
  | "home"
  | "videos";

export type Section = {
  key: SectionKey;
  title: string;
  blurb: string;
  itemLabel: string;
  /** The field shown as the item's heading. */
  heading: string;
  fields: readonly Field[];
};

export const SECTIONS: readonly Section[] = [
  {
    key: "options",
    title: "Options",
    blurb: "Places we are weighing before we pick one.",
    itemLabel: "option",
    heading: "place",
    fields: [
      { key: "place", label: "Place", type: "text" },
      { key: "roundTrip", label: "Round trip", type: "money" },
      { key: "oneWay", label: "One way", type: "money" },
      { key: "monthly", label: "Per month", type: "money" },
      { key: "visaFree", label: "Visa-free stay", type: "text" },
      { key: "timeGap", label: "Time vs Conroe", type: "text" },
      { key: "safety", label: "Safety", type: "text" },
      { key: "notes", label: "Notes", type: "long" },
      { key: "source", label: "Source", type: "url" },
    ],
  },
  {
    key: "documents",
    title: "Documents",
    blurb: "Passports, visas, arrival forms and anything else we must carry. Depends on where we go.",
    itemLabel: "document",
    heading: "document",
    fields: [
      { key: "document", label: "Document", type: "text" },
      { key: "who", label: "For", type: "text" },
      { key: "status", label: "Status", type: "choice", options: DOCUMENT_STATUSES },
      { key: "expires", label: "Expires", type: "date" },
      { key: "due", label: "Needed by", type: "date" },
      { key: "cost", label: "Cost", type: "money" },
      { key: "how", label: "How to get it", type: "long" },
      { key: "link", label: "Link", type: "url" },
    ],
  },
  {
    key: "budget",
    title: "Budget",
    blurb: "What we plan to spend and what we actually spent.",
    itemLabel: "budget line",
    heading: "item",
    fields: [
      { key: "item", label: "Item", type: "text" },
      { key: "category", label: "Category", type: "choice", options: ["Getting there", "Lodging", "Food", "Local transit", "Phone and internet", "Gear", "Fees and documents", "Insurance", "Fun", "Other"] },
      { key: "planned", label: "Planned", type: "money" },
      { key: "actual", label: "Actual", type: "money" },
      { key: "notes", label: "Notes", type: "long" },
    ],
  },
  {
    key: "travel",
    title: "Getting there",
    blurb: "Flights, buses and rides between places.",
    itemLabel: "leg",
    heading: "route",
    fields: [
      { key: "route", label: "From and to", type: "text" },
      { key: "mode", label: "How", type: "choice", options: ["Flight", "Bus", "Train", "Ride", "Ferry", "Other"] },
      { key: "date", label: "Date", type: "date" },
      { key: "carrier", label: "Airline or company", type: "text" },
      { key: "cost", label: "Cost", type: "money" },
      { key: "booked", label: "Booked", type: "check" },
      { key: "link", label: "Link", type: "url" },
      { key: "notes", label: "Notes", type: "long" },
    ],
  },
  {
    key: "stays",
    title: "Stays",
    blurb: "Where we sleep and work.",
    itemLabel: "stay",
    heading: "name",
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "area", label: "Area", type: "text" },
      { key: "checkIn", label: "Check in", type: "date" },
      { key: "checkOut", label: "Check out", type: "date" },
      { key: "cost", label: "Total cost", type: "money" },
      { key: "wifi", label: "Wi-Fi", type: "text" },
      { key: "booked", label: "Booked", type: "check" },
      { key: "link", label: "Link", type: "url" },
      { key: "notes", label: "Notes", type: "long" },
    ],
  },
  {
    key: "places",
    title: "Places to go",
    blurb: "What we want to see, eat and film.",
    itemLabel: "place",
    heading: "name",
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "area", label: "Area", type: "text" },
      { key: "why", label: "Why", type: "long" },
      { key: "link", label: "Link", type: "url" },
      { key: "visited", label: "Been there", type: "check" },
      { key: "filmed", label: "Filmed", type: "check" },
    ],
  },
  {
    key: "itinerary",
    title: "Itinerary",
    blurb: "Day by day.",
    itemLabel: "day",
    heading: "title",
    fields: [
      { key: "date", label: "Date", type: "date" },
      { key: "title", label: "Title", type: "text" },
      { key: "plan", label: "Plan", type: "long" },
      { key: "done", label: "Done", type: "check" },
    ],
  },
  {
    key: "entry",
    title: "Entry rules",
    blurb: "Passport, visas, forms and what is allowed.",
    itemLabel: "rule",
    heading: "rule",
    fields: [
      { key: "rule", label: "Rule", type: "text" },
      { key: "detail", label: "Detail", type: "long" },
      { key: "source", label: "Source", type: "url" },
      { key: "checked", label: "Checked on", type: "date" },
    ],
  },
  {
    key: "home",
    title: "Home checklist",
    blurb: "What has to happen at home before and while we are gone.",
    itemLabel: "task",
    heading: "task",
    fields: [
      { key: "task", label: "Task", type: "text" },
      { key: "who", label: "Who", type: "text" },
      { key: "due", label: "Due", type: "date" },
      { key: "done", label: "Done", type: "check" },
      { key: "notes", label: "Notes", type: "long" },
    ],
  },
  {
    key: "videos",
    title: "Videos",
    blurb: "Episodes for The Real Estate Bookkeeper series.",
    itemLabel: "video",
    heading: "title",
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "idea", label: "Idea", type: "long" },
      { key: "place", label: "Where", type: "text" },
      { key: "filmed", label: "Filmed", type: "check" },
      { key: "link", label: "Link", type: "url" },
    ],
  },
] as const;

export const SECTION_KEYS = SECTIONS.map((section) => section.key) as [SectionKey, ...SectionKey[]];
export function sectionFor(key: SectionKey): Section {
  const section = SECTIONS.find((candidate) => candidate.key === key);
  if (!section) throw new Error(`Unknown travel section ${key}`);
  return section;
}

export type ItemValue = string | number | boolean | null;
export type TripItem = { id: string } & Record<string, ItemValue>;
export type TripPlan = { summary: string; sections: Record<SectionKey, TripItem[]> };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const tripDateSchema = z.union([z.literal(""), z.string().regex(DATE, "Use a date like 2026-12-01")]);

function fieldSchema(field: Field): z.ZodType<ItemValue> {
  switch (field.type) {
    case "money":
      return z
        .union([z.number(), z.null()])
        .refine((value) => value === null || (Number.isFinite(value) && Math.abs(value) < 10_000_000), "Amount is too large")
        .transform((value) => (value === null ? null : Math.round(value * 100) / 100));
    case "check":
      return z.boolean();
    case "date":
      return tripDateSchema;
    case "url":
      return z.union([
        z.literal(""),
        z
          .string()
          .trim()
          .max(2000)
          .refine((value) => /^https?:\/\/[^\s]+$/i.test(value) && URL.canParse(value), "Use a full link starting with https://"),
      ]);
    case "choice":
      return z.union([z.literal(""), z.enum(field.options as [string, ...string[]])]);
    case "long":
      return z.string().trim().max(5000);
    case "text":
      return z.string().trim().max(200);
  }
}

function blankValue(field: Field): ItemValue {
  if (field.type === "money") return null;
  if (field.type === "check") return false;
  return "";
}

/** Validates one item from the page; unknown keys are dropped and missing ones get blanks. */
export function parseItem(sectionKey: SectionKey, raw: unknown): TripItem {
  const section = sectionFor(sectionKey);
  const input = z.object({ id: z.string().uuid() }).passthrough().parse(raw) as Record<string, unknown>;
  const item: TripItem = { id: input.id as string };
  for (const field of section.fields) {
    const value = input[field.key];
    item[field.key] = value === undefined ? blankValue(field) : fieldSchema(field).parse(value);
  }
  const heading = item[section.heading];
  if (typeof heading !== "string" || heading.length === 0) {
    throw new Error(`Give this ${section.itemLabel} a ${sectionFor(sectionKey).fields.find((f) => f.key === section.heading)?.label.toLowerCase()}.`);
  }
  return item;
}

/** Reads a saved plan leniently: bad items are skipped rather than breaking the page. */
export function parsePlan(raw: unknown): TripPlan {
  const object = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const sectionsRaw =
    object.sections && typeof object.sections === "object" && !Array.isArray(object.sections)
      ? (object.sections as Record<string, unknown>)
      : {};
  const sections = {} as Record<SectionKey, TripItem[]>;
  for (const section of SECTIONS) {
    const list = Array.isArray(sectionsRaw[section.key]) ? (sectionsRaw[section.key] as unknown[]) : [];
    sections[section.key] = list.flatMap((entry) => {
      try {
        return [parseItem(section.key, entry)];
      } catch {
        return [];
      }
    });
  }
  return { summary: typeof object.summary === "string" ? object.summary : "", sections };
}

export const MAX_ITEMS_PER_SECTION = 200;

export function upsertItem(plan: TripPlan, sectionKey: SectionKey, item: TripItem): TripPlan {
  const list = plan.sections[sectionKey];
  const index = list.findIndex((existing) => existing.id === item.id);
  if (index === -1 && list.length >= MAX_ITEMS_PER_SECTION) {
    throw new Error(`This list is full (${MAX_ITEMS_PER_SECTION} items).`);
  }
  const next = index === -1 ? [...list, item] : list.map((existing, i) => (i === index ? item : existing));
  return { ...plan, sections: { ...plan.sections, [sectionKey]: next } };
}

export function removeItem(plan: TripPlan, sectionKey: SectionKey, id: string): TripPlan {
  return {
    ...plan,
    sections: { ...plan.sections, [sectionKey]: plan.sections[sectionKey].filter((item) => item.id !== id) },
  };
}

export function moveItem(plan: TripPlan, sectionKey: SectionKey, id: string, direction: -1 | 1): TripPlan {
  const list = [...plan.sections[sectionKey]];
  const index = list.findIndex((item) => item.id === id);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= list.length) return plan;
  [list[index], list[target]] = [list[target], list[index]];
  return { ...plan, sections: { ...plan.sections, [sectionKey]: list } };
}

function sum(values: ItemValue[]): number {
  return Math.round(values.reduce<number>((total, value) => total + (typeof value === "number" ? value : 0), 0) * 100) / 100;
}

export type BudgetTotals = { planned: number; actual: number; booked: number };
/** Planned and actual come from the Budget list; booked adds up booked legs and stays. */
export function budgetTotals(plan: TripPlan): BudgetTotals {
  const booked = [...plan.sections.travel, ...plan.sections.stays].filter((item) => item.booked === true);
  return {
    planned: sum(plan.sections.budget.map((item) => item.planned)),
    actual: sum(plan.sections.budget.map((item) => item.actual)),
    booked: sum(booked.map((item) => item.cost)),
  };
}

/** Documents count as ready when we have them or the trip does not need them. */
export function documentsReady(plan: TripPlan): { ready: number; total: number } {
  const docs = plan.sections.documents;
  return { ready: docs.filter((d) => d.status === "Have it" || d.status === "Not needed").length, total: docs.length };
}

/**
 * Plain warnings for the top of the trip page: a document that has expired, or that expires before
 * the trip ends (or starts, when no end is set). `today` is YYYY-MM-DD.
 */
export function documentWarnings(plan: TripPlan, trip: { startsOn: string; endsOn: string }, today: string): string[] {
  const tripEnd = trip.endsOn || trip.startsOn;
  return plan.sections.documents.flatMap((doc) => {
    const expires = typeof doc.expires === "string" ? doc.expires : "";
    if (!expires || doc.status === "Not needed") return [];
    const name = `${doc.document}${doc.who ? ` (${doc.who})` : ""}`;
    if (expires < today) return [`${name} expired on ${expires}.`];
    if (tripEnd && expires < tripEnd) return [`${name} expires ${expires}, before the trip ends on ${tripEnd}.`];
    return [];
  });
}

export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "trip";
}

export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error("Too many trips with this name.");
}

export function formatMoney(value: number | null | undefined): string {
  if (typeof value !== "number") return "";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  });
}

export function emptyPlan(): TripPlan {
  return parsePlan({});
}

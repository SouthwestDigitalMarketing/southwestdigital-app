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

/** Kinds of day-to-day spots, in the order an option's page shows them. */
export const SPOT_KINDS = [
  "Neighborhood to stay",
  "Rental",
  "Work spot",
  "Gym",
  "Martial arts",
  "Getting around",
  "Music",
  "Groceries",
  "Other",
] as const;

export const DOCUMENT_STATUSES = ["Need it", "Applied", "Have it", "Not needed"] as const;

/** "coordinate" fields (lat/lng) are looked up on save and never shown in forms or on cards. */
export type FieldType = "text" | "long" | "money" | "hours" | "date" | "url" | "photo" | "check" | "choice" | "coordinate";
export type Field = { key: string; label: string; type: FieldType; options?: readonly string[] };
export type SectionKey =
  | "options"
  | "spots"
  | "documents"
  | "needs"
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
  /** The few fields a card shows; the item's own page shows everything. */
  summary: readonly string[];
  fields: readonly Field[];
};

export const SECTIONS: readonly Section[] = [
  {
    key: "options",
    title: "Options",
    blurb: "Places we are weighing before we pick one.",
    itemLabel: "option",
    heading: "place",
    summary: ["roundTrip", "monthly", "timeGap"],
    fields: [
      { key: "place", label: "Place", type: "text" },
      { key: "photo", label: "Photo link", type: "photo" },
      { key: "roundTrip", label: "Round trip", type: "money" },
      { key: "monthly", label: "Per month", type: "money" },
      { key: "visaFree", label: "Visa-free stay", type: "text" },
      { key: "hoursAhead", label: "Hours ahead of Conroe", type: "hours" },
      { key: "timeGap", label: "Time vs Conroe", type: "text" },
      { key: "safety", label: "Safety", type: "text" },
      { key: "gym", label: "Gym (Olympic lifts)", type: "long" },
      { key: "shakes", label: "Protein shakes per month", type: "money" },
      { key: "martialArts", label: "BJJ / Muay Thai", type: "long" },
      { key: "internet", label: "Internet", type: "long" },
      { key: "music", label: "Guitar and blues", type: "long" },
      { key: "notes", label: "Notes", type: "long" },
      { key: "source", label: "Source", type: "url" },
      { key: "lat", label: "Latitude", type: "coordinate" },
      { key: "lng", label: "Longitude", type: "coordinate" },
    ],
  },
  {
    key: "spots",
    title: "Day-to-day spots",
    blurb: "Where we would live, work, train, eat and play in each option.",
    itemLabel: "spot",
    heading: "name",
    summary: ["kind", "option", "area"],
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "photo", label: "Photo link", type: "photo" },
      { key: "kind", label: "Kind", type: "choice", options: SPOT_KINDS },
      { key: "option", label: "For option", type: "text" },
      { key: "area", label: "Area", type: "text" },
      { key: "why", label: "Why", type: "long" },
      { key: "link", label: "Link", type: "url" },
      { key: "lat", label: "Latitude", type: "coordinate" },
      { key: "lng", label: "Longitude", type: "coordinate" },
    ],
  },
  {
    key: "documents",
    title: "Documents",
    blurb: "Passports, visas, arrival forms and anything else we must carry. Depends on where we go.",
    itemLabel: "document",
    heading: "document",
    summary: ["status", "expires"],
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
    key: "needs",
    title: "Daily needs",
    blurb: "What every trip has to cover: training, food, internet, music.",
    itemLabel: "need",
    heading: "need",
    summary: ["where", "cost"],
    fields: [
      { key: "need", label: "Need", type: "text" },
      { key: "plan", label: "How we cover it here", type: "long" },
      { key: "where", label: "Where", type: "text" },
      { key: "cost", label: "Cost per month", type: "money" },
      { key: "link", label: "Link", type: "url" },
      { key: "covered", label: "Covered", type: "check" },
    ],
  },
  {
    key: "budget",
    title: "Budget",
    blurb: "What we plan to spend and what we actually spent.",
    itemLabel: "budget line",
    heading: "item",
    summary: ["category", "planned", "actual"],
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
    summary: ["date", "carrier", "cost"],
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
    summary: ["area", "checkIn", "cost"],
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "photo", label: "Photo link", type: "photo" },
      { key: "area", label: "Area", type: "text" },
      { key: "checkIn", label: "Check in", type: "date" },
      { key: "checkOut", label: "Check out", type: "date" },
      { key: "cost", label: "Total cost", type: "money" },
      { key: "wifi", label: "Wi-Fi", type: "text" },
      { key: "booked", label: "Booked", type: "check" },
      { key: "link", label: "Link", type: "url" },
      { key: "notes", label: "Notes", type: "long" },
      { key: "lat", label: "Latitude", type: "coordinate" },
      { key: "lng", label: "Longitude", type: "coordinate" },
    ],
  },
  {
    key: "places",
    title: "Places to go",
    blurb: "What we want to see, eat and film.",
    itemLabel: "place",
    heading: "name",
    summary: ["area"],
    fields: [
      { key: "name", label: "Name", type: "text" },
      { key: "photo", label: "Photo link", type: "photo" },
      { key: "area", label: "Area", type: "text" },
      { key: "why", label: "Why", type: "long" },
      { key: "link", label: "Link", type: "url" },
      { key: "visited", label: "Been there", type: "check" },
      { key: "filmed", label: "Filmed", type: "check" },
      { key: "lat", label: "Latitude", type: "coordinate" },
      { key: "lng", label: "Longitude", type: "coordinate" },
    ],
  },
  {
    key: "itinerary",
    title: "Itinerary",
    blurb: "Day by day.",
    itemLabel: "day",
    heading: "title",
    summary: ["date"],
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
    summary: ["checked"],
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
    summary: ["who", "due"],
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
    summary: ["place"],
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
/** `days` is the trip length used for option totals when the trip has no dates yet. */
export type TripPlan = { summary: string; days: number; sections: Record<SectionKey, TripItem[]> };
export const DEFAULT_DAYS = 30;
export const daysSchema = z.coerce.number().int("Use whole days.").min(1, "At least 1 day.").max(365, "At most 365 days.");

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const tripDateSchema = z.union([z.literal(""), z.string().regex(DATE, "Use a date like 2026-12-01")]);

function fieldSchema(field: Field): z.ZodType<ItemValue> {
  switch (field.type) {
    case "hours":
      return z.union([z.number().finite().min(-24).max(24), z.null()]);
    case "money":
      return z
        .union([z.number(), z.null()])
        .refine((value) => value === null || (Number.isFinite(value) && Math.abs(value) < 10_000_000), "Amount is too large")
        .transform((value) => (value === null ? null : Math.round(value * 100) / 100));
    case "check":
      return z.boolean();
    case "coordinate":
      return z.union([z.number().finite().min(-180).max(180), z.null()]);
    case "date":
      return tripDateSchema;
    case "url":
    case "photo":
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
  if (field.type === "money" || field.type === "hours" || field.type === "coordinate") return null;
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
  const days = daysSchema.safeParse(object.days);
  return {
    summary: typeof object.summary === "string" ? object.summary : "",
    days: days.success ? days.data : DEFAULT_DAYS,
    sections,
  };
}

/** Fields people see and edit (coordinates are looked up, not typed). */
export function visibleFields(section: Section): Field[] {
  return section.fields.filter((field) => field.type !== "coordinate");
}

export type MapPin = { section: SectionKey; id: string; name: string; lat: number; lng: number; photo: string | null };

/** The map pin for one item, or null when it has no location (or its list is not mappable). */
export function pinFor(sectionKey: SectionKey, item: TripItem): MapPin | null {
  const section = sectionFor(sectionKey);
  if (!section.fields.some((field) => field.type === "coordinate")) return null;
  if (typeof item.lat !== "number" || typeof item.lng !== "number") return null;
  return {
    section: sectionKey,
    id: item.id,
    name: String(item[section.heading] ?? ""),
    lat: item.lat,
    lng: item.lng,
    photo: typeof item.photo === "string" && item.photo ? item.photo : null,
  };
}

/** Every located option, stay and place on the trip, for the map. */
export function mapPins(plan: TripPlan): MapPin[] {
  return SECTIONS.flatMap((section) =>
    plan.sections[section.key].flatMap((item) => {
      const pin = pinFor(section.key, item);
      return pin ? [pin] : [];
    }),
  );
}

/** Items that can sit on the map but have no pin yet. */
export function itemsWithoutPin(plan: TripPlan, sectionKey: SectionKey): TripItem[] {
  return sectionFor(sectionKey).fields.some((field) => field.type === "coordinate")
    ? plan.sections[sectionKey].filter(
        (item) =>
          (typeof item.lat !== "number" || typeof item.lng !== "number") &&
          // A transit system is a whole network, not a point on the map.
          !(sectionKey === "spots" && item.kind === "Getting around"),
      )
    : [];
}

/** Lists whose items carry a photo (filled from Wikipedia when left blank). */
export function hasPhotos(sectionKey: SectionKey): boolean {
  return sectionFor(sectionKey).fields.some((field) => field.type === "photo");
}

/**
 * Options, places and spots get a photo when saved without one (Wikipedia, or the spot's own web
 * page); stays are usually rentals, so no guess.
 */
export const AUTO_PHOTO_SECTIONS: ReadonlySet<SectionKey> = new Set(["options", "places", "spots"]);

/** Spots that belong to an option, grouped by kind in SPOT_KINDS order. */
export function spotsFor(plan: TripPlan, optionName: string): Array<{ kind: string; spots: TripItem[] }> {
  const name = optionName.trim().toLowerCase();
  const mine = plan.sections.spots.filter((spot) => String(spot.option ?? "").trim().toLowerCase() === name);
  return SPOT_KINDS.flatMap((kind) => {
    const spots = mine.filter((spot) => (spot.kind || "Other") === kind);
    return spots.length ? [{ kind, spots }] : [];
  });
}

/** An Airbnb search for monthly stays in an area (Airbnb's own search page; we never scrape it). */
export function airbnbSearchUrl(place: string): string {
  const path = place
    .split(",")
    .map((part) => part.trim().replace(/\s+/g, "-"))
    .filter(Boolean)
    .join("--");
  return `https://www.airbnb.com/s/${encodeURIComponent(path)}/homes?monthly_stay=true`;
}

/** Items in a photo list that still have no photo. */
export function itemsWithoutPhoto(plan: TripPlan, sectionKey: SectionKey): TripItem[] {
  return hasPhotos(sectionKey) ? plan.sections[sectionKey].filter((item) => !item.photo) : [];
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

/** Trip length in days: from the dates when both are set (inclusive), otherwise the plan's own number. */
export function tripDays(plan: TripPlan, trip: { startsOn: string; endsOn: string }): number {
  if (trip.startsOn && trip.endsOn) {
    const span = Math.round((Date.parse(`${trip.endsOn}T00:00:00Z`) - Date.parse(`${trip.startsOn}T00:00:00Z`)) / 86_400_000) + 1;
    if (Number.isFinite(span) && span >= 1) return span;
  }
  return plan.days;
}

/** An option's whole cost: the round trip plus the monthly cost for the trip's length. Null when neither is known. */
export function optionTotal(item: TripItem, days: number): number | null {
  const flight = typeof item.roundTrip === "number" ? item.roundTrip : null;
  const monthly = typeof item.monthly === "number" ? item.monthly : null;
  if (flight === null && monthly === null) return null;
  return Math.round((flight ?? 0) + (monthly ?? 0) * (days / 30));
}

export const OPTION_SORTS = { mine: "Your order", total: "Lowest total", time: "Closest to Conroe time" } as const;
export type OptionSort = keyof typeof OPTION_SORTS;

/** Options in the chosen order; anything missing the sort value goes last, ties keep your order. */
export function sortOptions(items: TripItem[], sort: OptionSort, days: number): TripItem[] {
  if (sort === "mine") return items;
  const value = (item: TripItem) =>
    sort === "total" ? optionTotal(item, days) : typeof item.hoursAhead === "number" ? Math.abs(item.hoursAhead) : null;
  return items
    .map((item, index) => ({ item, index, value: value(item) }))
    .sort((a, b) => {
      if (a.value === null || b.value === null) return a.value === null ? (b.value === null ? a.index - b.index : 1) : -1;
      if (a.value !== b.value) return a.value - b.value;
      if (sort === "time") {
        const at = optionTotal(a.item, days) ?? Infinity;
        const bt = optionTotal(b.item, days) ?? Infinity;
        if (at !== bt) return at - bt;
      }
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

export function formatHours(value: number): string {
  if (value === 0) return "Same time";
  const hours = Math.abs(value);
  return `${hours} hour${hours === 1 ? "" : "s"} ${value > 0 ? "ahead" : "behind"}`;
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

/**
 * The trip in focus (Tom, 2026-11-26): Japan, about 6 weeks in Tokyo then 2 weeks in Kyoto and
 * Osaka. Earlier plans used these places as options; a trip still carrying them can be switched.
 */
export const JAPAN_DESTINATION = "Japan: Tokyo, Kyoto & Osaka";
export const EARLIER_PLACES = ["Mexico City", "Mérida, Mexico", "Medellín, Colombia", "Fukuoka, Japan", "Chiang Mai, Thailand"];

function sameName(a: unknown, b: unknown) {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

/** True for a trip that still carries an earlier plan (the five places, or Fukuoka). */
export function needsJapanSwitch(plan: TripPlan, destination: string): boolean {
  const earlier = plan.sections.options.some((option) => EARLIER_PLACES.some((place) => sameName(place, option.place)));
  const current = plan.sections.options.some((option) => sameName(option.place, JAPAN_DESTINATION));
  return earlier || (current && !sameName(destination, JAPAN_DESTINATION));
}

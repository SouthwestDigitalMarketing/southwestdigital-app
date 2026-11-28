import { z } from "zod";

/** Van hunt lists, forms and validation share these definitions, as in Travel. */
export const STATUSES = ["Watching", "Asked seller", "Going to see", "Inspected", "Offer made", "Passed", "Bought"] as const;
export type Status = (typeof STATUSES)[number];
export type ItemValue = string | number | boolean | null;
export type VanItem = { id: string } & Record<string, ItemValue>;
export type SectionKey = "needs" | "candidates" | "costs";
export type VanPlan = { sections: Record<SectionKey, VanItem[]> };
export type Field = {
  key: string;
  label: string;
  type: "text" | "long" | "money" | "number" | "url" | "status";
  required?: boolean;
  integer?: boolean;
  min?: number;
  max?: number;
};
export type Section = { key: SectionKey; title: string; itemLabel: string; fields: readonly Field[] };

export const SECTIONS: readonly Section[] = [
  { key: "needs", title: "Must-haves", itemLabel: "must-have", fields: [
    { key: "name", label: "Must-have", type: "text", required: true },
  ] },
  { key: "candidates", title: "Candidates", itemLabel: "candidate", fields: [
    { key: "year", label: "Year", type: "number", integer: true, min: 1900, max: 2100 },
    { key: "make", label: "Make", type: "text", required: true },
    { key: "model", label: "Model / build", type: "text", required: true },
    { key: "price", label: "Price ($)", type: "money" },
    { key: "miles", label: "Miles", type: "number", integer: true },
    { key: "city", label: "City", type: "text" },
    { key: "seller", label: "Seller / private or dealer", type: "text" },
    { key: "contact", label: "Contact", type: "text" },
    { key: "link", label: "Listing link", type: "url" },
    { key: "batteryAh", label: "Battery (Ah)", type: "number" },
    { key: "solarW", label: "Solar (W)", type: "number" },
    { key: "inverterW", label: "Inverter (W)", type: "number" },
    { key: "power", label: "Power details / battery type", type: "long" },
    { key: "heat", label: "Heat", type: "text" },
    { key: "ac", label: "AC", type: "text" },
    { key: "water", label: "Water", type: "text" },
    { key: "bathroom", label: "Bathroom", type: "text" },
    { key: "notes", label: "Notes / worries", type: "long" },
    { key: "status", label: "Status", type: "status" },
  ] },
  { key: "costs", title: "Costs to plan", itemLabel: "cost", fields: [
    { key: "name", label: "Cost", type: "text", required: true },
    { key: "amount", label: "Amount ($)", type: "money" },
    { key: "notes", label: "Notes / period covered", type: "long" },
  ] },
];
export const SECTION_KEYS = ["needs", "candidates", "costs"] as const;

export const CHECKLISTS = [
  { title: "Pre-purchase inspection", items: [
    { key: "inspector", label: "NRVIA inspector" },
    { key: "mechanic", label: "Mechanic for chassis" },
    { key: "roof", label: "Roof / water damage" },
    { key: "charging", label: "Battery / charging" },
    { key: "heaterAc", label: "Heater / AC" },
    { key: "propane", label: "Propane leak test" },
    { key: "tires", label: "Tires: DOT date" },
    { key: "rust", label: "Rust underneath" },
    { key: "title", label: "Title matches VIN and seller" },
  ] },
  { title: "Test drive", items: [
    { key: "coldStart", label: "Cold start" },
    { key: "highway", label: "Highway" },
    { key: "brakes", label: "Brakes" },
    { key: "house", label: "Every house system on" },
    { key: "smells", label: "Smells / stains" },
    { key: "standing", label: "Stand up inside" },
    { key: "laptop", label: "Laptop at work spot" },
  ] },
] as const;
export const CHECK_ITEMS = CHECKLISTS.flatMap<{ key: string; label: string }>((list) => list.items);
const CHECK_KEYS = CHECK_ITEMS.map((item) => item.key);
export const MAX_ITEMS = 200;

export function sectionFor(key: SectionKey): Section {
  return SECTIONS.find((section) => section.key === key)!;
}

function parseField(field: Field, raw: unknown): ItemValue {
  const value = raw === undefined ? (field.type === "money" || field.type === "number" ? null : field.type === "status" ? "Watching" : "") : raw;
  if (field.type === "status") return z.enum(STATUSES).parse(value);
  if (field.type === "money" || field.type === "number") {
    let schema = z.number().finite().min(field.min ?? 0).max(field.max ?? 9_999_999);
    if (field.integer) schema = schema.int();
    const parsed = schema.nullable().parse(value);
    return parsed === null ? null : Math.round(parsed * 100) / 100;
  }
  const text = z.string().trim().max(field.type === "long" ? 5000 : field.type === "url" ? 2000 : 200).parse(value);
  if (field.required && !text) throw new Error(`Fill in ${field.label.toLowerCase()}.`);
  if (field.type === "url" && text) {
    const valid = URL.canParse(text) && /^https?:\/\/[^\s]+$/i.test(text);
    if (!valid) throw new Error("Use a full listing link starting with https://.");
  }
  return text;
}

/** Only declared fields survive; forms cannot add unvalidated JSON keys. */
export function parseItem(key: SectionKey, raw: unknown): VanItem {
  const input = z.object({ id: z.string().uuid() }).passthrough().parse(raw);
  const item: VanItem = { id: input.id };
  for (const field of sectionFor(key).fields) item[field.key] = parseField(field, input[field.key]);
  if (key === "candidates") {
    for (const check of CHECK_KEYS) item[check] = z.boolean().parse(input[check] ?? false);
  }
  return item;
}

/** Older / incomplete saved plans fill missing lists; malformed items cannot break the page. */
export function parsePlan(raw: unknown): VanPlan {
  const root = z.object({ sections: z.record(z.string(), z.unknown()).optional() }).safeParse(raw);
  const sections = {} as VanPlan["sections"];
  for (const key of SECTION_KEYS) {
    const list = root.success ? root.data.sections?.[key] : undefined;
    sections[key] = Array.isArray(list) ? list.flatMap((item) => {
      try { return [parseItem(key, item)]; } catch { return []; }
    }) : [];
  }
  return { sections };
}

export function emptyPlan(): VanPlan { return parsePlan({}); }

export const changeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("save"), section: z.enum(SECTION_KEYS), item: z.unknown() }),
  z.object({ kind: z.literal("remove"), section: z.enum(SECTION_KEYS), id: z.string().uuid() }),
  z.object({ kind: z.literal("status"), id: z.string().uuid(), status: z.enum(STATUSES) }),
  z.object({ kind: z.literal("check"), id: z.string().uuid(), key: z.enum(CHECK_KEYS as [string, ...string[]]), done: z.boolean() }),
]);
export type Change = z.infer<typeof changeSchema>;

/** Apply one edit to the latest locked plan, preserving unrelated candidate checklist ticks. */
export function changePlan(plan: VanPlan, raw: unknown): VanPlan {
  const change = changeSchema.parse(raw);
  if (change.kind === "status" || change.kind === "check") {
    if (!plan.sections.candidates.some((item) => item.id === change.id)) throw new Error("That van no longer exists.");
    return { sections: { ...plan.sections, candidates: plan.sections.candidates.map((item) => item.id !== change.id ? item : {
      ...item, ...(change.kind === "status" ? { status: change.status } : { [change.key]: change.done }),
    }) } };
  }
  const list = plan.sections[change.section];
  if (change.kind === "remove") return { sections: { ...plan.sections, [change.section]: list.filter((item) => item.id !== change.id) } };
  const item = parseItem(change.section, change.item);
  const previous = list.find((entry) => entry.id === item.id);
  if (!previous && list.length >= MAX_ITEMS) throw new Error(`This list is full (${MAX_ITEMS} items).`);
  if (previous && change.section === "candidates") {
    for (const key of CHECK_KEYS) item[key] = previous[key];
  }
  return { sections: { ...plan.sections, [change.section]: previous ? list.map((entry) => entry.id === item.id ? item : entry) : [...list, item] } };
}

export function sortedCandidates(items: VanItem[]): VanItem[] {
  return [...items].sort((a, b) => STATUSES.indexOf(a.status as Status) - STATUSES.indexOf(b.status as Status)
    || (typeof a.price === "number" ? a.price : Infinity) - (typeof b.price === "number" ? b.price : Infinity));
}
export function candidateName(item: VanItem): string {
  return [item.year, item.make, item.model].filter((part) => part !== null && part !== "").join(" ");
}

export const TAX_RATE = 0.0625;
export const TITLE_FEE = 33;
export const PRIVATE_SALE_NOTE = "Private sales: tax is on the price or 80% of the state presumptive value, whichever is higher.";
export const CASH_EXCLUSIONS = "before registration, inspection, insurance";

/** Price-based estimate only. Round each dollar amount to cents before adding. */
export function cashNeeded(price: number | null): { price: number; tax: number; title: number; total: number } | null {
  if (price === null) return null;
  const cents = Math.round(z.number().finite().min(0).max(9_999_999).parse(price) * 100);
  const taxCents = Math.round(cents * TAX_RATE);
  return { price: cents / 100, tax: taxCents / 100, title: TITLE_FEE, total: (cents + taxCents + TITLE_FEE * 100) / 100 };
}
export function costTotals(items: VanItem[]): { total: number; unquoted: number } {
  return { total: items.reduce((sum, item) => sum + (typeof item.amount === "number" ? Math.round(item.amount * 100) : 0), 0) / 100,
    unquoted: items.filter((item) => typeof item.amount !== "number").length };
}
export function formatMoney(value: number): string {
  const cents = !Number.isInteger(value);
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 });
}

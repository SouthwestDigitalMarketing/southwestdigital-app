"use server";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import {
  AUTO_PHOTO_SECTIONS,
  SECTION_KEYS,
  TRIP_STATUSES,
  daysSchema,
  emptyPlan,
  moveItem,
  parseItem,
  parsePlan,
  removeItem,
  sectionFor,
  slugify,
  tripDateSchema,
  uniqueSlug,
  upsertItem,
  type SectionKey,
  type TripItem,
  type TripPlan,
} from "@/lib/travel/plan";
import {
  OLD_REMOTE_MONTHS_TITLE,
  REMOTE_MONTHS_DESTINATION,
  REMOTE_MONTHS_TITLE,
  remoteMonthsPlan,
  switchToJapan,
} from "@/lib/travel/starter";
import { geocode, lookupPlace, pagePhoto } from "@/lib/travel/photos";
import { standingNeeds } from "@/lib/travel/needs";
import { suggestionsFor } from "@/lib/travel/spots";

const titleSchema = z.string().trim().min(1, "Give the trip a name.").max(120);

export async function createTripAction(formData: FormData) {
  const { dataContext } = await requireStaffBrandOrThrow();
  const starter = formData.get("starter") === "remote-months";
  const title = starter ? REMOTE_MONTHS_TITLE : titleSchema.parse(formData.get("title"));
  const plan = starter ? remoteMonthsPlan() : emptyPlan();
  if (starter) plan.days = 60;
  if (starter) plan.sections.options = await enrich("options", plan.sections.options, "", new Map());
  // Every trip starts with Tom's standing needs (gym, shakes, martial arts, internet, guitar).
  plan.sections.needs = standingNeeds(randomUUID);
  const slug = await withBrandDataTransaction(dataContext, async (tx) => {
    const rows = await tx.trip.findMany({ where: { brandId: dataContext.brandId }, select: { slug: true } });
    const next = uniqueSlug(slugify(title), new Set(rows.map((row) => row.slug)));
    await tx.trip.create({
      data: {
        brandId: dataContext.brandId,
        slug: next,
        title,
        status: "planning",
        destination: starter ? REMOTE_MONTHS_DESTINATION : "",
        plan: plan as unknown as Prisma.InputJsonValue,
      },
    });
    return next;
  });
  revalidatePath("/travel");
  redirect(`/travel/${slug}`);
}

const detailsSchema = z
  .object({
    title: titleSchema,
    status: z.enum(TRIP_STATUSES),
    destination: z.string().trim().max(120),
    startsOn: tripDateSchema,
    endsOn: tripDateSchema,
    summary: z.string().trim().max(5000),
    days: daysSchema,
  })
  .refine((d) => !d.startsOn || !d.endsOn || d.startsOn <= d.endsOn, "The trip ends before it starts.");

const MAP_SECTIONS: ReadonlySet<SectionKey> = new Set(["options", "stays", "places", "spots"]);
/** Spot kinds that are public things with Wikipedia articles; businesses use their own page's photo. */
const WIKI_SPOT_KINDS = new Set(["Neighborhood to stay", "Getting around"]);

function located(item: TripItem) {
  return typeof item.lat === "number" && typeof item.lng === "number";
}

/**
 * Adds what an item can get from the web: a photo (options and places, when blank) and a map pin
 * (options, stays and places). A pin is kept while the name and area stay the same and looked up
 * again when they change. Runs one item at a time: OpenStreetMap asks for at most one request a second.
 */
async function enrich(
  section: SectionKey,
  items: TripItem[],
  destination: string,
  previous: Map<string, TripItem>,
): Promise<TripItem[]> {
  if (!MAP_SECTIONS.has(section)) return items;
  const heading = sectionFor(section).heading;
  const out: TripItem[] = [];
  for (const original of items) {
    let item = original;
    const before = previous.get(item.id);
    const name = String(item[heading] ?? "");
    const area = typeof item.area === "string" ? item.area : "";
    if (before && before[heading] === item[heading] && (before.area ?? "") === (item.area ?? "") && located(before)) {
      item = { ...item, lat: before.lat, lng: before.lng };
    } else if (before) {
      item = { ...item, lat: null, lng: null };
    }
    const wantPhoto = AUTO_PHOTO_SECTIONS.has(section) && !item.photo;
    const wantPin = !located(item);
    // A spot belongs to an option ("Mexico City"); that is its place, not the trip's destination.
    const where = section === "spots" ? String(item.option ?? "") : destination;
    const link = typeof item.link === "string" ? item.link : "";
    const wiki = section !== "stays" && (section !== "spots" || WIKI_SPOT_KINDS.has(String(item.kind)));
    if (wantPhoto && section === "spots" && link) {
      const photo = await pagePhoto(link);
      if (photo) item = { ...item, photo };
    }
    if (wiki && ((wantPhoto && !item.photo) || wantPin)) {
      const found =
        where && section !== "options"
          ? await lookupPlace(`${name} ${where}`).then(async (hit) => (hit.photo || hit.lat !== null ? hit : lookupPlace(name)))
          : await lookupPlace(name);
      if (wantPhoto && !item.photo && found.photo) item = { ...item, photo: found.photo };
      if (wantPin && found.lat !== null && found.lng !== null) item = { ...item, lat: found.lat, lng: found.lng };
    }
    if (!located(item) && !(section === "spots" && item.kind === "Getting around")) {
      // "Condesa (Tamaulipas 60)": try the street address, then the plain neighbourhood.
      const address = /\(([^)]*\d[^)]*)\)/.exec(area)?.[1] ?? "";
      const plainArea = area.replace(/\([^)]*\)/g, "").split(/[,;/]| and /)[0].trim();
      const queries =
        section === "stays"
          ? [[plainArea, where], [where]]
          : [[name, plainArea, where], [address, where], [plainArea, where]];
      for (const parts of queries) {
        const text = parts.filter(Boolean).join(", ");
        if (!text) continue;
        const pin = await geocode(text);
        if (pin) {
          item = { ...item, lat: pin.lat, lng: pin.lng };
          break;
        }
      }
    }
    out.push(item);
  }
  return out;
}

type Change =
  | { kind: "details"; details: unknown }
  | { kind: "fill"; section: string }
  | { kind: "standingNeeds" }
  | { kind: "suggestSpots"; option: string }
  | { kind: "switchToJapan" }
  | { kind: "save"; section: string; item: unknown }
  | { kind: "remove"; section: string; id: string }
  | { kind: "move"; section: string; id: string; direction: -1 | 1 };

const sectionSchema = z.enum(SECTION_KEYS);

/** A reason the page can show; production hides thrown server-action messages. */
function reason(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Check the fields and try again.";
  if (error instanceof Error && !(error instanceof Prisma.PrismaClientKnownRequestError)) return error.message;
  return "That did not save. Try again.";
}

/** Every edit on a trip page: reads the row under a lock, applies one change, writes it back. */
export async function changeTripAction(slug: string, change: Change): Promise<{ error?: string }> {
  const { dataContext } = await requireStaffBrandOrThrow();
  try {
    await applyChange(dataContext, slug, await prepare(dataContext, slug, change));
  } catch (error) {
    return { error: reason(error) };
  }
  revalidatePath("/travel");
  revalidatePath(`/travel/${slug}`);
  return {};
}

type Context = Awaited<ReturnType<typeof requireStaffBrandOrThrow>>["dataContext"];
type Found = { photo?: string; lat?: number; lng?: number };
type Prepared =
  | Change
  | { kind: "setFound"; section: SectionKey; found: Record<string, Found> }
  | { kind: "addSpots"; items: TripItem[] };

/** Photo and pin lookups are network calls, so they run before the locked transaction, never inside it. */
async function prepare(dataContext: Context, slug: string, change: Change): Promise<Prepared> {
  if (change.kind === "suggestSpots") {
    const option = z.string().trim().min(1).max(200).parse(change.option);
    const trip = await withBrandDataTransaction(dataContext, (tx) =>
      tx.trip.findUnique({ where: { brandId_slug: { brandId: dataContext.brandId, slug } }, select: { plan: true } }),
    );
    if (!trip) throw new Error("That trip no longer exists.");
    const existing = parsePlan(trip.plan).sections.spots.filter((spot) => String(spot.option ?? "").toLowerCase() === option.toLowerCase());
    const fresh = suggestionsFor(option, existing.map((spot) => String(spot.name ?? "")));
    if (fresh.length === 0) throw new Error(`No new suggestions for ${option}.`);
    const items = fresh.map((spot) => parseItem("spots", { id: randomUUID(), ...spot, option }));
    return { kind: "addSpots", items: await enrich("spots", items, "", new Map()) };
  }
  if (change.kind !== "save" && change.kind !== "fill") return change;
  const section = sectionSchema.parse(change.section);
  if (!MAP_SECTIONS.has(section)) return change;
  const trip = await withBrandDataTransaction(dataContext, (tx) =>
    tx.trip.findUnique({ where: { brandId_slug: { brandId: dataContext.brandId, slug } }, select: { destination: true, plan: true } }),
  );
  if (!trip) throw new Error("That trip no longer exists.");
  const stored = parsePlan(trip.plan).sections[section];
  const previous = new Map(stored.map((item) => [item.id, item]));
  if (change.kind === "save") {
    const [item] = await enrich(section, [parseItem(section, change.item)], trip.destination, previous);
    return { ...change, item };
  }
  const missing = stored.filter((item) => (AUTO_PHOTO_SECTIONS.has(section) && !item.photo) || !located(item));
  const filled = await enrich(section, missing, trip.destination, new Map());
  const found: Record<string, Found> = {};
  for (const item of filled) {
    const entry: Found = {};
    if (typeof item.photo === "string" && item.photo) entry.photo = item.photo;
    if (located(item)) {
      entry.lat = item.lat as number;
      entry.lng = item.lng as number;
    }
    if (Object.keys(entry).length) found[item.id] = entry;
  }
  if (Object.keys(found).length === 0) throw new Error("Nothing found. Add an area, or paste a photo link with Edit.");
  return { kind: "setFound", section, found };
}

async function applyChange(dataContext: Context, slug: string, change: Prepared) {
  await withBrandDataTransaction(dataContext, async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Trip" WHERE "brandId" = ${dataContext.brandId} AND "slug" = ${slug} FOR UPDATE`;
    if (locked.length === 0) throw new Error("That trip no longer exists.");
    const row = await tx.trip.findUniqueOrThrow({ where: { id: locked[0].id } });
    let plan: TripPlan = parsePlan(row.plan);
    const data: Prisma.TripUpdateInput = {};
    switch (change.kind) {
      case "details": {
        const details = detailsSchema.parse(change.details);
        data.title = details.title;
        data.status = details.status;
        data.destination = details.destination;
        data.startsOn = details.startsOn;
        data.endsOn = details.endsOn;
        plan = { ...plan, summary: details.summary, days: details.days };
        break;
      }
      case "save": {
        const section = sectionSchema.parse(change.section);
        plan = upsertItem(plan, section, parseItem(section, change.item));
        break;
      }
      case "fill":
        break;
      case "suggestSpots":
        break;
      case "switchToJapan":
        plan = switchToJapan(plan);
        if (row.title === OLD_REMOTE_MONTHS_TITLE) data.title = REMOTE_MONTHS_TITLE;
        data.destination = REMOTE_MONTHS_DESTINATION;
        break;
      case "addSpots":
        for (const item of change.items) {
          const taken = plan.sections.spots.some(
            (spot) =>
              String(spot.option ?? "").toLowerCase() === String(item.option ?? "").toLowerCase() &&
              String(spot.name ?? "").toLowerCase() === String(item.name ?? "").toLowerCase(),
          );
          if (!taken) plan = upsertItem(plan, "spots", item);
        }
        break;
      case "standingNeeds":
        if (plan.sections.needs.length === 0) plan = { ...plan, sections: { ...plan.sections, needs: standingNeeds(randomUUID) } };
        break;
      case "setFound":
        plan = {
          ...plan,
          sections: {
            ...plan.sections,
            [change.section]: plan.sections[change.section].map((item) => {
              const found = change.found[item.id];
              if (!found) return item;
              return {
                ...item,
                photo: item.photo || found.photo || "",
                lat: located(item) ? item.lat : (found.lat ?? null),
                lng: located(item) ? item.lng : (found.lng ?? null),
              };
            }),
          },
        };
        break;
      case "remove":
        plan = removeItem(plan, sectionSchema.parse(change.section), z.string().uuid().parse(change.id));
        break;
      case "move":
        plan = moveItem(
          plan,
          sectionSchema.parse(change.section),
          z.string().uuid().parse(change.id),
          change.direction === -1 ? -1 : 1,
        );
        break;
    }
    data.plan = plan as unknown as Prisma.InputJsonValue;
    await tx.trip.update({ where: { id: row.id }, data });
  });
}

export async function deleteTripAction(slug: string) {
  const { dataContext } = await requireStaffBrandOrThrow();
  await withBrandDataTransaction(dataContext, (tx) =>
    tx.trip.deleteMany({ where: { brandId: dataContext.brandId, slug } }),
  );
  revalidatePath("/travel");
  redirect("/travel");
}

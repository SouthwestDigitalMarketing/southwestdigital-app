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
import { REMOTE_MONTHS_TITLE, remoteMonthsPlan } from "@/lib/travel/starter";
import { geocode, lookupPlace } from "@/lib/travel/photos";
import { standingNeeds } from "@/lib/travel/needs";

const titleSchema = z.string().trim().min(1, "Give the trip a name.").max(120);

export async function createTripAction(formData: FormData) {
  const { dataContext } = await requireStaffBrandOrThrow();
  const starter = formData.get("starter") === "remote-months";
  const title = starter ? REMOTE_MONTHS_TITLE : titleSchema.parse(formData.get("title"));
  const plan = starter ? remoteMonthsPlan() : emptyPlan();
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
  })
  .refine((d) => !d.startsOn || !d.endsOn || d.startsOn <= d.endsOn, "The trip ends before it starts.");

const MAP_SECTIONS: ReadonlySet<SectionKey> = new Set(["options", "stays", "places"]);

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
    if ((wantPhoto || wantPin) && section !== "stays") {
      const found =
        destination && section === "places"
          ? await lookupPlace(`${name} ${destination}`).then(async (hit) => (hit.photo || hit.lat !== null ? hit : lookupPlace(name)))
          : await lookupPlace(name);
      if (wantPhoto && found.photo) item = { ...item, photo: found.photo };
      if (wantPin && found.lat !== null && found.lng !== null) item = { ...item, lat: found.lat, lng: found.lng };
    }
    if (!located(item)) {
      const queries =
        section === "stays"
          ? [[area, destination], [destination]]
          : [[name, area, destination], [area, destination]];
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
type Prepared = Change | { kind: "setFound"; section: SectionKey; found: Record<string, Found> };

/** Photo and pin lookups are network calls, so they run before the locked transaction, never inside it. */
async function prepare(dataContext: Context, slug: string, change: Change): Promise<Prepared> {
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
        plan = { ...plan, summary: details.summary };
        break;
      }
      case "save": {
        const section = sectionSchema.parse(change.section);
        plan = upsertItem(plan, section, parseItem(section, change.item));
        break;
      }
      case "fill":
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

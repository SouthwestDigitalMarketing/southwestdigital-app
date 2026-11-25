"use server";

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
  slugify,
  tripDateSchema,
  uniqueSlug,
  upsertItem,
  type SectionKey,
  type TripItem,
  type TripPlan,
} from "@/lib/travel/plan";
import { REMOTE_MONTHS_TITLE, remoteMonthsPlan } from "@/lib/travel/starter";
import { findPlacePhoto } from "@/lib/travel/photos";

const titleSchema = z.string().trim().min(1, "Give the trip a name.").max(120);

export async function createTripAction(formData: FormData) {
  const { dataContext } = await requireStaffBrandOrThrow();
  const starter = formData.get("starter") === "remote-months";
  const title = starter ? REMOTE_MONTHS_TITLE : titleSchema.parse(formData.get("title"));
  const plan = starter ? remoteMonthsPlan() : emptyPlan();
  if (starter) plan.sections.options = await withPhotos("options", plan.sections.options, "");
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

async function withPhotos(section: SectionKey, items: TripItem[], destination: string): Promise<TripItem[]> {
  if (!AUTO_PHOTO_SECTIONS.has(section)) return items;
  return Promise.all(
    items.map(async (item) => {
      if (item.photo) return item;
      const name = String(item[section === "options" ? "place" : "name"] ?? "");
      const photo =
        (destination && section === "places" ? await findPlacePhoto(`${name} ${destination}`) : null) ??
        (await findPlacePhoto(name));
      return photo ? { ...item, photo } : item;
    }),
  );
}

type Change =
  | { kind: "details"; details: unknown }
  | { kind: "photos"; section: string }
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
type Prepared = Change | { kind: "setPhotos"; section: SectionKey; photos: Record<string, string> };

/** Photo lookups are network calls, so they run before the locked transaction, never inside it. */
async function prepare(dataContext: Context, slug: string, change: Change): Promise<Prepared> {
  if (change.kind !== "save" && change.kind !== "photos") return change;
  const section = sectionSchema.parse(change.section);
  if (!AUTO_PHOTO_SECTIONS.has(section)) return change;
  const trip = await withBrandDataTransaction(dataContext, (tx) =>
    tx.trip.findUnique({ where: { brandId_slug: { brandId: dataContext.brandId, slug } }, select: { destination: true, plan: true } }),
  );
  if (!trip) throw new Error("That trip no longer exists.");
  if (change.kind === "save") {
    const [item] = await withPhotos(section, [parseItem(section, change.item)], trip.destination);
    return { ...change, item };
  }
  const missing = parsePlan(trip.plan).sections[section].filter((item) => !item.photo);
  const found = await withPhotos(section, missing, trip.destination);
  const photos = Object.fromEntries(found.filter((item) => item.photo).map((item) => [item.id, String(item.photo)]));
  if (Object.keys(photos).length === 0) throw new Error("No photos found. Paste a photo link with Edit.");
  return { kind: "setPhotos", section, photos };
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
      case "photos":
        break;
      case "setPhotos":
        plan = {
          ...plan,
          sections: {
            ...plan.sections,
            [change.section]: plan.sections[change.section].map((item) =>
              !item.photo && change.photos[item.id] ? { ...item, photo: change.photos[item.id] } : item,
            ),
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

"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import {
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
  type TripPlan,
} from "@/lib/travel/plan";
import { REMOTE_MONTHS_TITLE, remoteMonthsPlan } from "@/lib/travel/starter";

const titleSchema = z.string().trim().min(1, "Give the trip a name.").max(120);

export async function createTripAction(formData: FormData) {
  const { dataContext } = await requireStaffBrandOrThrow();
  const starter = formData.get("starter") === "remote-months";
  const title = starter ? REMOTE_MONTHS_TITLE : titleSchema.parse(formData.get("title"));
  const plan = starter ? remoteMonthsPlan() : emptyPlan();
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

type Change =
  | { kind: "details"; details: unknown }
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
    await applyChange(dataContext, slug, change);
  } catch (error) {
    return { error: reason(error) };
  }
  revalidatePath("/travel");
  revalidatePath(`/travel/${slug}`);
  return {};
}

async function applyChange(
  dataContext: Awaited<ReturnType<typeof requireStaffBrandOrThrow>>["dataContext"],
  slug: string,
  change: Change,
) {
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

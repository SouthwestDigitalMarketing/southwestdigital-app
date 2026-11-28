"use server";

import { revalidatePath } from "next/cache";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { showChannelBrand } from "@/lib/showrunner/channel-brand";
import { createBrandDataContext, withBrandDataTransaction } from "@/lib/tenancy/context";

import { writeLocalFinish, writeLocalTeaser, writeLocalThumbnail } from "@/lib/showrunner/finish";

/** Run review (Tom, 2026-11-25): ripley picks the request up within a minute and sends back a new scorecard. */
export async function requestReview(batch: string) {
  if (!/^[A-Za-z0-9-]{1,60}$/.test(batch)) throw new Error("Not a video.");
  const { brand: active, dataContext } = await requireStaffBrandOrThrow();
  const brand = await showChannelBrand(active);
  await withBrandDataTransaction(createBrandDataContext({ brandId: brand.id, actorUserId: dataContext.actorUserId }), (tx) =>
    tx.showrunnerVideoStatus.updateMany({ where: { brandId: brand.id, batch }, data: { reviewRequestedAt: new Date() } }),
  );
  revalidatePath(`/showrunner/editor/${batch}`);
}

/** Finish (Tom, 2026-11-27): tell ripley to build the waiting video. Optional note goes to Johnny. */
export async function requestFinish(data: FormData) {
  const batch = String(data.get("batch") ?? "");
  const note = String(data.get("note") ?? "").trim().slice(0, 2000);
  if (!/^[A-Za-z0-9-]{1,60}$/.test(batch)) throw new Error("Not a video.");
  const { brand: active, dataContext } = await requireStaffBrandOrThrow();
  const brand = await showChannelBrand(active);
  await withBrandDataTransaction(createBrandDataContext({ brandId: brand.id, actorUserId: dataContext.actorUserId }), (tx) =>
    tx.showrunnerVideoStatus.updateMany({
      where: { brandId: brand.id, batch },
      data: { finishRequestedAt: new Date(), finishNote: note || null },
    }),
  );
  await writeLocalFinish(batch, note);
  revalidatePath(`/showrunner/editor/${batch}`);
  revalidatePath(`/showrunner/production/${batch}`);
}

/** Use this thumbnail text (Tom, 2026-11-27): remake the picture; the encode keeps running. */
export async function requestThumbnailText(data: FormData) {
  const batch = String(data.get("batch") ?? "");
  const custom = String(data.get("custom") ?? "").trim();
  const picked = String(data.get("text") ?? "").trim();
  const text = (custom || picked).slice(0, 60);
  if (!/^[A-Za-z0-9-]{1,60}$/.test(batch)) throw new Error("Not a video.");
  if (!text) throw new Error("Pick thumbnail words, or type your own.");
  const { brand: active, dataContext } = await requireStaffBrandOrThrow();
  const brand = await showChannelBrand(active);
  await withBrandDataTransaction(createBrandDataContext({ brandId: brand.id, actorUserId: dataContext.actorUserId }), (tx) =>
    tx.showrunnerVideoStatus.updateMany({
      where: { brandId: brand.id, batch },
      data: { thumbnailRequestedAt: new Date(), thumbnailRequestText: text, thumbnailBusy: true, thumbnailText: text },
    }),
  );
  await writeLocalThumbnail(batch, text);
  revalidatePath(`/showrunner/editor/${batch}`);
  revalidatePath(`/showrunner/production/${batch}`);
  revalidatePath("/showrunner");
}

/** Teaser before the title (Tom, 2026-11-27): off, or this stretch of the transcript. */
export async function requestTeaser(data: FormData) {
  const batch = String(data.get("batch") ?? "");
  const off = String(data.get("wanted") ?? "") === "false";
  const start = Number(data.get("start"));
  const end = Number(data.get("end"));
  if (!/^[A-Za-z0-9-]{1,60}$/.test(batch)) throw new Error("Not a video.");
  const request = off ? ({ wanted: false } as const) : ({ wanted: true, start, end } as const);
  if (!off && (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)) {
    throw new Error("Highlight a stretch of the transcript.");
  }
  const { brand: active, dataContext } = await requireStaffBrandOrThrow();
  const brand = await showChannelBrand(active);
  await withBrandDataTransaction(createBrandDataContext({ brandId: brand.id, actorUserId: dataContext.actorUserId }), async (tx) => {
    const row = await tx.showrunnerVideoStatus.findFirst({
      where: { brandId: brand.id, batch },
      select: { teaser: true },
    });
    const previous = row?.teaser && typeof row.teaser === "object" ? (row.teaser as Record<string, unknown>) : {};
    await tx.showrunnerVideoStatus.updateMany({
      where: { brandId: brand.id, batch },
      data: {
        teaserRequestedAt: new Date(),
        teaserRequest: request,
        teaserBusy: true,
        teaser: off ? { ...previous, wanted: false } : { ...previous, wanted: true, start, end },
      },
    });
  });
  await writeLocalTeaser(batch, request);
  revalidatePath(`/showrunner/editor/${batch}`);
  revalidatePath(`/showrunner/production/${batch}`);
  revalidatePath("/showrunner");
}

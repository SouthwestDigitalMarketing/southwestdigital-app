"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { changeSongs, parseSongs, starterSongs } from "@/lib/music/setList";
import { withBrandDataTransaction } from "@/lib/tenancy/context";

function reason(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Check the song details.";
  if (error instanceof Error && !(error instanceof Prisma.PrismaClientKnownRequestError)) return error.message;
  return "That did not save. Try again.";
}

export async function startSetListAction(): Promise<{ error?: string }> {
  const { dataContext } = await requireStaffBrandOrThrow();
  try {
    await withBrandDataTransaction(dataContext, (tx) => tx.musicSetList.upsert({
      where: { brandId: dataContext.brandId },
      create: { brandId: dataContext.brandId, songs: starterSongs() as unknown as Prisma.InputJsonValue },
      // A double tap or a second tab must never replace an existing list.
      update: {},
    }));
  } catch (error) { return { error: reason(error) }; }
  revalidatePath("/music/set-list");
  return {};
}

/** Like Van: authorize, set the RLS context, lock the row, then change one song. */
export async function changeSongAction(change: unknown): Promise<{ error?: string }> {
  const { dataContext } = await requireStaffBrandOrThrow();
  try {
    await withBrandDataTransaction(dataContext, async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "MusicSetList" WHERE "brandId" = ${dataContext.brandId} FOR UPDATE`;
      if (!locked.length) throw new Error("Start the set list first.");
      const row = await tx.musicSetList.findUniqueOrThrow({ where: { id: locked[0].id } });
      const songs = changeSongs(parseSongs(row.songs), change);
      await tx.musicSetList.update({ where: { id: row.id }, data: { songs: songs as unknown as Prisma.InputJsonValue } });
    });
  } catch (error) { return { error: reason(error) }; }
  revalidatePath("/music/set-list");
  return {};
}

"use server";

import { ContactTagKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { contactNotes, GROUP_TAGS, MUSIC_TAG } from "@/lib/music/people";
import { SET_LIST_CONTACTS } from "@/lib/music/setListContacts";
import { parseSubmittedPhone } from "@/lib/phone";
import { withBrandDataTransaction } from "@/lib/tenancy/context";

export type AddPeopleResult = { created: number; tagged: number; error?: string };

/**
 * One tap adds the researched people as contact cards (Tom, 2026-11-28). Safe to repeat:
 * anyone already there (same phone, or same name with no phone) only gets the tags.
 * Tags are CUSTOM with no pipeline automation, so nothing lands in the CRM.
 */
export async function addSetListPeopleAction(): Promise<AddPeopleResult> {
  const { brand, dataContext } = await requireStaffBrandOrThrow();
  const result: AddPeopleResult = { created: 0, tagged: 0 };
  try {
    const tagIds = await withBrandDataTransaction(dataContext, async (tx) => {
      const ids: Record<string, string> = {};
      for (const tag of [MUSIC_TAG, ...Object.values(GROUP_TAGS)]) {
        const row = await tx.contactTag.upsert({
          where: { brandId_key: { brandId: brand.id, key: tag.key } },
          create: { brandId: brand.id, key: tag.key, label: tag.label, kind: ContactTagKind.CUSTOM },
          update: { isActive: true },
          select: { id: true },
        });
        ids[tag.key] = row.id;
      }
      return ids;
    });

    // One short transaction per contact, like the CSV import.
    for (const person of SET_LIST_CONTACTS) {
      const wanted = [tagIds[MUSIC_TAG.key], tagIds[GROUP_TAGS[person.group as keyof typeof GROUP_TAGS].key]];
      const phoneE164 = person.phone ? parseSubmittedPhone(person.phone) : null;
      await withBrandDataTransaction(dataContext, async (tx) => {
        const existing = await tx.contact.findFirst({
          where: phoneE164 ? { brandId: brand.id, phoneE164 } : { brandId: brand.id, name: person.name, phoneE164: null },
          select: { id: true },
        });
        if (existing) {
          await tx.contactTagLink.createMany({
            data: wanted.map((tagId) => ({ contactId: existing.id, tagId })),
            skipDuplicates: true,
          });
          result.tagged += 1;
          return;
        }
        await tx.contact.create({
          data: {
            brandId: brand.id,
            name: person.name,
            firstName: person.name,
            lastName: "",
            company: person.name,
            phoneE164,
            notes: contactNotes(person),
            isActive: true,
            tagLinks: { create: wanted.map((tagId) => ({ tagId })) },
          },
          select: { id: true },
        });
        result.created += 1;
      });
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : "That did not finish. Try again; it skips anyone already added.";
  }
  revalidatePath("/music", "layout");
  revalidatePath("/contacts");
  return result;
}

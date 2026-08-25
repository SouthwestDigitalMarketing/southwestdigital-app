"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { DEFAULT_TOOL_LINKS, parseToolUrl, type ToolLinkKey } from "@/lib/brands/tools";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function updateToolLinksAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();

  const updates = DEFAULT_TOOL_LINKS.map((fallback) => {
    const key = fallback.key;
    const label = clean(formData.get(`label-${key}`)) || fallback.label;
    if (label.length > 40) {
      throw new Error(`${fallback.label} label must be 40 characters or fewer.`);
    }
    const url = parseToolUrl(clean(formData.get(`url-${key}`))) ?? "";
    return { key, label, url, sortOrder: fallback.sortOrder };
  });

  await prisma.$transaction(
    updates.map((link) =>
      prisma.brandToolLink.upsert({
        where: { brandId_key: { brandId: brand.id, key: link.key } },
        create: {
          brandId: brand.id,
          key: link.key as ToolLinkKey,
          label: link.label,
          url: link.url,
          sortOrder: link.sortOrder,
        },
        update: {
          label: link.label,
          url: link.url,
          sortOrder: link.sortOrder,
        },
      }),
    ),
  );

  revalidatePath("/", "layout");
  revalidatePath("/settings");
}

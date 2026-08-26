"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaffBrandOrThrow } from "@/lib/brands/staff";
import { DEFAULT_TOOL_LINKS, parseToolUrl, type ToolLinkKey } from "@/lib/brands/tools";
import { normalizeBrandColor } from "@/lib/brands/colors";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function updateBrandAppearanceAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();
  const primaryColor = normalizeBrandColor(clean(formData.get("primaryColor")));
  const mode = clean(formData.get("mode"));
  const sidebarLogoType = clean(formData.get("sidebarLogoType"));

  if (!primaryColor) {
    throw new Error("Enter a HEX color or an RGB value, such as #17324d or rgb(23, 50, 77).");
  }
  if (!new Set(["system", "light", "dark"]).has(mode)) {
    throw new Error("Choose System, Light, or Dark for the portal theme.");
  }
  if (!new Set(["mark", "logo"]).has(sidebarLogoType)) {
    throw new Error("Choose whether the sidebar shows the logo mark or full logo.");
  }

  await prisma.brandTheme.upsert({
    where: { brandId: brand.id },
    create: { brandId: brand.id, primaryColor, mode, sidebarLogoType },
    update: { primaryColor, mode, sidebarLogoType },
  });

  revalidatePath("/", "layout");
  revalidatePath("/settings");
}

export async function updateProposalMediaAction(formData: FormData) {
  const { brand } = await requireStaffBrandOrThrow();
  const proposalFeaturedMediaUrl = clean(formData.get("proposalFeaturedMediaUrl")) || null;

  await prisma.brandTheme.upsert({
    where: { brandId: brand.id },
    create: { brandId: brand.id, primaryColor: "#17324d", mode: "system", sidebarLogoType: "mark", proposalFeaturedMediaUrl },
    update: { proposalFeaturedMediaUrl },
  });

  revalidatePath("/", "layout");
  revalidatePath("/settings");
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

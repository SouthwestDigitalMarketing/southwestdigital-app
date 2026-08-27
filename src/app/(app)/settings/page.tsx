import { prisma } from "@/lib/prisma";
import { requireStaffBrand } from "@/lib/brands/staff";
import { mergeToolLinks } from "@/lib/brands/tools";
import { ToolLinksForm } from "./ToolLinksForm";
import { BrandAppearanceForm } from "./BrandAppearanceForm";

export default async function SettingsPage() {
  const { brand } = await requireStaffBrand();

  const stored = await prisma.brandToolLink.findMany({
    where: { brandId: brand.id },
    select: { key: true, label: true, url: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="p-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
      </div>

      <div className="mt-6 grid gap-4">
        <BrandAppearanceForm
          theme={{
            primaryColor: brand.theme?.primaryColor ?? "#17324d",
            darkColor: brand.theme?.darkColor ?? null,
            accentColor: brand.theme?.accentColor ?? "#d79b3b",
            accentDarkColor: brand.theme?.accentDarkColor ?? null,
            mode: brand.theme?.mode ?? "system",
            logoUrl: brand.theme?.logoUrl ?? null,
            logoMarkUrl: brand.theme?.logoMarkUrl ?? null,
            logoDarkUrl: brand.theme?.logoDarkUrl ?? null,
            logoMarkDarkUrl: brand.theme?.logoMarkDarkUrl ?? null,
            sidebarLogoType: brand.theme?.sidebarLogoType ?? "mark",
          }}
        />
<ToolLinksForm links={mergeToolLinks(stored)} />
      </div>
    </div>
  );
}

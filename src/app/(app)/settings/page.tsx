import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaffBrand } from "@/lib/brands/staff";
import { mergeToolLinks } from "@/lib/brands/tools";
import { ToolLinksForm } from "./ToolLinksForm";
import { BrandAppearanceForm } from "./BrandAppearanceForm";
import { ProposalMediaSettingsForm } from "./ProposalMediaSettingsForm";

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
        <p className="mt-1 text-sm text-slate-500">
          Brand preferences for {brand.name}. Tool links are shared with everyone on this brand.
        </p>
      </div>

      <div className="mt-6 grid gap-4">
        <BrandAppearanceForm
          theme={{
            primaryColor: brand.theme?.primaryColor ?? "#17324d",
            mode: brand.theme?.mode ?? "system",
            logoUrl: brand.theme?.logoUrl ?? null,
            logoMarkUrl: brand.theme?.logoMarkUrl ?? null,
            logoDarkUrl: brand.theme?.logoDarkUrl ?? null,
            logoMarkDarkUrl: brand.theme?.logoMarkDarkUrl ?? null,
            sidebarLogoType: brand.theme?.sidebarLogoType ?? "mark",
          }}
        />
        <Link
          href="/settings/tags"
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 hover:border-slate-300"
        >
          <div>
            <p className="text-sm font-semibold text-slate-900">Tags</p>
            <p className="mt-0.5 text-sm text-slate-500">
              Add, rename, and delete the shared contact tag list.
            </p>
          </div>
          <span className="text-sm font-medium text-slate-500">Open →</span>
        </Link>
        <ProposalMediaSettingsForm currentUrl={brand.theme?.proposalFeaturedMediaUrl ?? null} />
        <ToolLinksForm links={mergeToolLinks(stored)} />
      </div>
    </div>
  );
}

import { requireStaffBrand } from "@/lib/brands/staff";
import { prisma } from "@/lib/prisma";
import MediaLibraryClient from "./MediaLibraryClient";

export default async function MediaPage() {
  const { brand } = await requireStaffBrand();

  const items = await prisma.brandMedia.findMany({
    where: { brandId: brand.id },
    select: { id: true, name: true, type: true, url: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="p-8">
      <h1 className="sr-only">Media</h1>
      <section className="max-w-2xl">
        <h2 className="text-lg font-semibold text-slate-900">Proposal media</h2>
        <p className="mt-1 text-sm text-slate-500">
          Videos and images available for proposal intros.
        </p>
        <div className="mt-4">
          <MediaLibraryClient items={items} />
        </div>
      </section>
    </div>
  );
}

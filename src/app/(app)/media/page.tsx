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
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Media Library</h1>
        <p className="mt-1 text-sm text-slate-500">
          Videos and images you can use in proposal intros. These are link references — the files
          themselves stay on YouTube, Vimeo, Cloudflare, or wherever they&apos;re hosted.
        </p>
      </div>
      <div className="mt-6 max-w-2xl">
        <MediaLibraryClient items={items} />
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAppBrand } from "@/lib/brands/staff";
import { showChannelBrand } from "@/lib/showrunner/channel-brand";
import { loadEpisodes } from "@/lib/showrunner/load";
import { createBrandDataContext } from "@/lib/tenancy/context";

export const dynamic = "force-dynamic";

/** One episode chosen in the Editor tab (Tom, 2026-11-25). The editing tools are not built yet. */
export default async function EditEpisodePage({ params }: { params: Promise<{ batch: string }> }) {
  const { batch } = await params;
  const { brand: active, dataContext } = await requireAppBrand();
  const brand = await showChannelBrand(active);
  const episode = (await loadEpisodes(createBrandDataContext({ brandId: brand.id, actorUserId: dataContext.actorUserId })))
    .find((row) => row.batch === batch);
  if (!episode) notFound();
  return (
    <div className="px-4 py-5 sm:p-8">
      <Link href="/showrunner/editor" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600">
        <ChevronLeft size={16} aria-hidden="true" /> All episodes
      </Link>
      <div className="mt-3 max-w-3xl rounded-2xl border border-slate-200 bg-white p-4">
        {episode.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- inline data: JPEG from ripley
          <img src={episode.thumbnail} alt="" className="aspect-video w-full rounded-xl object-cover" />
        ) : null}
        <h1 className="mt-3 text-lg font-semibold leading-snug text-slate-900">{episode.title ?? episode.project ?? "Untitled"}</h1>
        {episode.title && episode.project ? <p className="mt-0.5 text-xs text-slate-500">{episode.project}</p> : null}
        <p className="mt-2 text-sm text-slate-600">{episode.url ? "Published on YouTube" : episode.stage ?? "In production"}</p>
        {episode.url ? (
          <a href={episode.url} target="_blank" rel="noopener" className="mt-3 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Watch on YouTube
          </a>
        ) : null}
      </div>
      <p className="mt-4 max-w-3xl rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Editing tools for this episode come next.</p>
    </div>
  );
}

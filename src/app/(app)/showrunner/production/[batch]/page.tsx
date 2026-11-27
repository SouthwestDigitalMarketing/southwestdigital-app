import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAppBrand } from "@/lib/brands/staff";
import { VideosInProgress } from "@/components/showrunner/VideosInProgress";
import { WaitingActions } from "@/components/showrunner/WaitingActions";
import { showChannelBrand } from "@/lib/showrunner/channel-brand";
import { loadVideoCards } from "@/lib/showrunner/load";
import { isWaitingForYou } from "@/lib/showrunner/production";
import { createBrandDataContext } from "@/lib/tenancy/context";

export const dynamic = "force-dynamic";

/** One video's production, from the production bar (Tom, 2026-11-25): every step, render bars, thumbnail, YouTube link. */
export default async function ProductionPage({ params }: { params: Promise<{ batch: string }> }) {
  const { batch } = await params;
  const { brand: active, dataContext } = await requireAppBrand();
  const brand = await showChannelBrand(active);
  const cards = await loadVideoCards(createBrandDataContext({ brandId: brand.id, actorUserId: dataContext.actorUserId }));
  const video = cards.find((card) => card.batch === batch);
  if (!video) notFound();
  // The bar shows one video ("+1 more"); the others in production follow it here.
  const others = cards.filter((card) => card.batch !== batch && !card.url);
  return (
    <div className="px-4 py-5 sm:p-8 [&_section]:mt-3">
      <Link href="/showrunner" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600">
        <ChevronLeft size={16} aria-hidden="true" /> Showrunner
      </Link>
      <h1 className="sr-only">Video production</h1>
      <div
        className={`mt-3 max-w-3xl rounded-2xl border p-4 ${
          isWaitingForYou(video.steps, video.stage) ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"
        }`}
      >
        <WaitingActions
          batch={video.batch}
          finishing={Boolean(video.finishRequestedAt)}
          waiting={isWaitingForYou(video.steps, video.stage)}
          published={Boolean(video.url)}
        />
      </div>
      <VideosInProgress videos={[video, ...others]} copyBatch={video.batch} />
    </div>
  );
}

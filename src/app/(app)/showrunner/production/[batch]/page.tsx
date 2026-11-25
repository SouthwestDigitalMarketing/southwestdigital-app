import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAppBrand } from "@/lib/brands/staff";
import { VideosInProgress } from "@/components/showrunner/VideosInProgress";
import { showChannelBrand } from "@/lib/showrunner/channel-brand";
import { loadVideoCards } from "@/lib/showrunner/load";
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
      {video.steps?.some((step) => step.state === "now" && step.label.startsWith("Waiting for you")) ? (
        <p className="mt-3 max-w-3xl rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Waiting for you. In the SWapp send app, tap Add more clips to send b-roll, or Finish to build it.
        </p>
      ) : null}
      <VideosInProgress videos={[video, ...others]} />
    </div>
  );
}

import Link from "next/link";
import { requireAppBrand } from "@/lib/brands/staff";
import { ChannelGraph } from "@/components/showrunner/ChannelGraph";
import { VideosInProgress } from "@/components/showrunner/VideosInProgress";
import { loadVideoCards } from "@/lib/showrunner/load";
import type { GraphData } from "@/lib/showrunner/graph-layout";
import graphData from "@/lib/showrunner/channel-graph.json";

const card = "block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

export default async function ShowrunnerPage() {
  const { brand, dataContext } = await requireAppBrand();
  const videos = await loadVideoCards(dataContext);

  return (
    <main className="p-8">
      <h1 className="text-3xl font-semibold text-slate-900">Showrunner</h1>
      <p className="mt-2 text-slate-600">What are we making for {brand.name}?</p>
      <VideosInProgress videos={videos} />
      <div className="mt-6 max-w-3xl">
        <ChannelGraph data={graphData as GraphData} />
      </div>
      <div className="mt-6 flex max-w-xl flex-col gap-4">
        <Link href="/youtube/new" className={`${card} hover:border-slate-400`}>
          <p className="text-lg font-semibold text-slate-900">New episode</p>
          <p className="mt-1 text-sm text-slate-600">Send clips from your phone. Showrunner edits and publishes.</p>
        </Link>
        <div className={`${card} opacity-60`} aria-disabled="true">
          <p className="text-lg font-semibold text-slate-900">Continue a series</p>
          <p className="mt-1 text-sm text-slate-600">No series yet. Start one below.</p>
        </div>
        <Link href="/showrunner/new-series" className={`${card} hover:border-slate-400`}>
          <p className="text-lg font-semibold text-slate-900">New series</p>
          <p className="mt-1 text-sm text-slate-600">Showrunner suggests a series from your channel and business.</p>
        </Link>
      </div>
    </main>
  );
}

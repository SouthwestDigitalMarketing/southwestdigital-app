import Link from "next/link";
import { requireAppBrand } from "@/lib/brands/staff";
import { ChannelGraph } from "@/components/showrunner/ChannelGraph";
import type { GraphData } from "@/lib/showrunner/graph-layout";
import graphData from "@/lib/showrunner/channel-graph.json";

const card = "block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

export default async function SeriesPage() {
  const { brand } = await requireAppBrand();

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Series</h1>
      <p className="mt-2 text-slate-600">What are we making for {brand.name}?</p>
      <div className="mt-6 max-w-3xl">
        <ChannelGraph data={graphData as GraphData} />
      </div>
      <div className="mt-6 flex max-w-xl flex-col gap-4">
        <Link href="/showrunner/studio" className={`${card} hover:border-indigo-400`}>
          <p className="text-lg font-semibold text-slate-900">The $10K Month · Studio</p>
          <p className="mt-1 text-sm text-slate-600">Plan this week&apos;s episode, then shoot one clip at a time.</p>
        </Link>
        <Link href="/showrunner/new-series" className={`${card} hover:border-slate-400`}>
          <p className="text-lg font-semibold text-slate-900">New series</p>
          <p className="mt-1 text-sm text-slate-600">Showrunner suggests a series from your channel and business.</p>
        </Link>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useState } from "react";
import { KeywordPicker, useKeyword } from "../KeywordPicker";
import { LocalSeoMap } from "../LocalSeoMap";
import { scanStats, type Scan } from "../stats";

const dateTime = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function MapTab({ scans, keywords }: { scans: Scan[]; keywords: string[] }) {
  const latest = scans[0];
  const phrases = latest?.keywords.length ? latest.keywords : keywords;
  const keyword = useKeyword(phrases);
  const stats = scanStats(latest, keyword);
  // The map is the view; the plain grid only shows when the map cannot load (no key or load error).
  const [mapUnavailable, setMapUnavailable] = useState(!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
  const markMapUnavailable = useCallback(() => setMapUnavailable(true), []);
  const cells = stats.cells.slice().sort((a, b) => a.row - b.row || a.column - b.column);

  return (
    <div className="space-y-3 p-4 sm:p-6">
      <h1 className="sr-only">Local SEO map</h1>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <KeywordPicker keywords={phrases} value={keyword} />
        <Stat label="Top 3" value={stats.topThreeShare === null ? "—" : `${Math.round(stats.topThreeShare * 100)}%`} detail={`${stats.topThree} of ${stats.complete} points`} />
        <Stat label="Average rank" value={stats.averageRank === null ? "—" : stats.averageRank.toFixed(1)} detail="where we appear" />
        <Stat label="Scan" value={latest ? latest.status : "none"} detail={latest ? dateTime(latest.startedAt) : "run one on Scan"} />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4" data-no-swipe>
        {latest && cells.length > 0 && !mapUnavailable ? <LocalSeoMap cells={cells} onUnavailable={markMapUnavailable} /> : null}
        {!latest || cells.length === 0 ? <p className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">No results for this phrase yet.</p> : !mapUnavailable ? null : (
          <div className="mx-auto grid max-w-[420px] gap-2" style={{ gridTemplateColumns: `repeat(${latest.gridSize}, minmax(0, 1fr))` }} aria-label={`Map rank grid for ${keyword}`}>
            {cells.map((cell) => <div key={`${cell.row}-${cell.column}`} title={`${cell.latitude}, ${cell.longitude}`} className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-xs font-semibold ${cell.status !== "complete" ? "border-slate-200 bg-slate-100 text-slate-400" : cell.rank === null ? "border-red-200 bg-red-100 text-red-900" : cell.rank <= 3 ? "border-emerald-300 bg-emerald-100 text-emerald-950" : cell.rank <= 10 ? "border-amber-300 bg-amber-100 text-amber-950" : "border-orange-300 bg-orange-100 text-orange-950"}`}><span>{cell.rank === null ? (cell.status === "complete" ? "—" : "…") : `#${cell.rank}`}</span><span className="mt-1 text-[9px] font-normal">{cell.row + 1},{cell.column + 1}</span></div>)}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
          <Legend color="bg-emerald-200" label="Top 3" /><Legend color="bg-amber-200" label="4–10" /><Legend color="bg-orange-200" label="11–20" /><Legend color="bg-red-200" label="Not in top 20" />
          <span className="text-slate-500">{mapUnavailable ? "North at the top, west at the left." : "Each badge is one search point,"} about {latest?.spacingMiles ?? "—"} mi apart; ranks use the Google Maps order.</span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div><p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="text-sm text-slate-600"><b className="text-base text-slate-950">{value}</b> · {detail}</p></div>;
}

function Legend({ color, label }: { color: string; label: string }) { return <span className="inline-flex items-center gap-1.5"><span className={`h-3 w-3 rounded ${color}`} />{label}</span>; }

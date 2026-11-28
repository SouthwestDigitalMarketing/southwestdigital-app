"use client";

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { KeywordPicker, useKeyword } from "../KeywordPicker";
import { hasResults, scanStats, type Scan } from "../stats";

export function TrendsTab({ scans, keywords }: { scans: Scan[]; keywords: string[] }) {
  const latest = scans.find(hasResults) ?? scans[0];
  const phrases = latest?.keywords.length ? latest.keywords : keywords;
  const keyword = useKeyword(phrases);
  const visibleCells = scanStats(latest, keyword).cells;
  const competitors = useMemo(() => {
    const counts = new Map<string, { name: string; appearances: number; bestRank: number }>();
    for (const cell of visibleCells) for (const competitor of cell.competitors ?? []) {
      const prior = counts.get(competitor.name) ?? { name: competitor.name, appearances: 0, bestRank: competitor.rank };
      counts.set(competitor.name, { ...prior, appearances: prior.appearances + 1, bestRank: Math.min(prior.bestRank, competitor.rank) });
    }
    return [...counts.values()].sort((a, b) => b.appearances - a.appearances || a.bestRank - b.bestRank).slice(0, 6);
  }, [visibleCells]);
  const history = scans.filter((scan) => hasResults(scan) && scan.keywords.includes(keyword)).slice().reverse().map((scan) => {
    const stats = scanStats(scan, keyword);
    return {
      date: new Date(scan.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      average: stats.averageRank === null ? null : Number(stats.averageRank.toFixed(1)),
      top3: stats.topThreeShare === null ? 0 : Number((stats.topThreeShare * 100).toFixed(1)),
    };
  });

  return (
    <div className="space-y-3 p-4 sm:p-6">
      <h1 className="sr-only">Local SEO trends</h1>
      <KeywordPicker keywords={phrases} value={keyword} />
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" data-no-swipe>
          <h2 className="text-sm font-semibold text-slate-900">Rank history</h2>
          <p className="mt-0.5 text-xs text-slate-500">Average rank (blue, lower is better) and top 3 share (green) for this phrase.</p>
          {history.length < 2 ? <p className="mt-6 text-sm text-slate-500">History appears after more scans.</p> : (
            <div className="mt-3 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history} margin={{ top: 8, right: 18, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="rank" reversed domain={[1, 20]} />
                  <YAxis yAxisId="share" orientation="right" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <Tooltip />
                  <Line yAxisId="rank" type="monotone" dataKey="average" name="Average rank" stroke="#2563eb" connectNulls />
                  <Line yAxisId="share" type="monotone" dataKey="top3" name="Top 3 share" stroke="#16a34a" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-semibold text-slate-900">Who else shows up</h2>
          <p className="mt-0.5 text-xs text-slate-500">Other businesses in this phrase&apos;s latest grid.</p>
          {competitors.length === 0 ? <p className="mt-6 text-sm text-slate-500">No competitor results yet.</p> : (
            <div className="mt-2 divide-y divide-slate-100">
              {competitors.map((competitor) => (
                <div key={competitor.name} className="flex items-center justify-between gap-4 py-2">
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{competitor.name}</p><p className="text-xs text-slate-500">best rank #{competitor.bestRank}</p></div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{competitor.appearances}/{visibleCells.length} points</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

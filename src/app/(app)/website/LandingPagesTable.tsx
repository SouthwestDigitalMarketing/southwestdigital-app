"use client";

import { useState } from "react";

export type ProcessedLandingRow = {
  page: string;
  source: string;
  sessions: number;
  activeUsers: number;
  engagementRate: number;
};

const SOURCE_COLORS: Record<string, string> = {
  Facebook: "bg-blue-100 text-blue-700",
  "Google Ads": "bg-green-100 text-green-700",
  Google: "bg-green-100 text-green-700",
  Instagram: "bg-pink-100 text-pink-700",
  TikTok: "bg-purple-100 text-purple-700",
  "Bing Ads": "bg-cyan-100 text-cyan-700",
  Twitter: "bg-sky-100 text-sky-700",
  LinkedIn: "bg-blue-100 text-blue-800",
  Email: "bg-amber-100 text-amber-700",
  Newsletter: "bg-amber-100 text-amber-700",
  Pinterest: "bg-rose-100 text-rose-700",
  Yahoo: "bg-violet-100 text-violet-700",
  "Organic / Direct": "bg-slate-100 text-slate-500",
};

const SOURCE_TOOLTIPS: Record<string, string> = {
  Facebook: "Visitor clicked a link shared on Facebook",
  "Google Ads": "Visitor clicked a Google paid search ad",
  Google: "Visitor arrived via Google organic search",
  Instagram: "Visitor clicked a link shared on Instagram",
  TikTok: "Visitor clicked a link shared on TikTok",
  "Bing Ads": "Visitor clicked a Microsoft Bing paid search ad",
  Twitter: "Visitor clicked a link shared on Twitter / X",
  LinkedIn: "Visitor clicked a link shared on LinkedIn",
  Email: "Visitor clicked a link in an email campaign",
  Newsletter: "Visitor clicked a link in a newsletter",
  Pinterest: "Visitor clicked a link shared on Pinterest",
  Yahoo: "Visitor arrived via Yahoo search",
  "Organic / Direct": "Arrived via organic search (Google, Bing, etc.), typed the URL directly, or used a bookmark — no ad or campaign tracking detected",
};

type Tooltip = { text: string; x: number; y: number };

export function LandingPagesTable({ rows }: { rows: ProcessedLandingRow[] }) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  if (rows.length === 0) {
    return <p className="mt-3 text-sm text-slate-400">No data for this period.</p>;
  }

  return (
    <>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead>
            <tr>
              <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Page</th>
              <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Source</th>
              <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Sessions</th>
              <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Users</th>
              <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Engagement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, i) => {
              const badge = SOURCE_COLORS[row.source] ?? "bg-slate-100 text-slate-600";
              const tipText = SOURCE_TOOLTIPS[row.source] ?? row.source;
              return (
                <tr key={i}>
                  <td className="max-w-xs break-words px-3 py-2 text-slate-700">{row.page}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span
                      className={`inline-block cursor-default rounded-full px-2 py-0.5 text-xs font-medium ${badge}`}
                      onMouseEnter={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setTooltip({ text: tipText, x: r.left + r.width / 2, y: r.top });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {row.source}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">{new Intl.NumberFormat("en-US").format(row.sessions)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">{new Intl.NumberFormat("en-US").format(row.activeUsers)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">{`${(row.engagementRate * 100).toFixed(1)}%`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 w-56 -translate-x-1/2 -translate-y-full rounded-lg bg-slate-800 px-3 py-2 text-xs text-white shadow-lg"
          style={{ left: tooltip.x, top: tooltip.y - 8 }}
        >
          {tooltip.text}
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </>
  );
}

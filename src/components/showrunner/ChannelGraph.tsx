"use client";

import { useMemo, useState } from "react";
import {
  GRAPH_HEIGHT,
  GRAPH_WIDTH,
  layoutGraph,
  neighborIds,
  type GraphData,
  type GraphNode,
} from "@/lib/showrunner/graph-layout";

const LANE_COLOR = { journey: "#ea8a3c", evergreen: "#1f9d82", bridge: "#d9568f" } as const;
const TOPIC_COLOR = "#7c6be6";

function radius(node: GraphNode): number {
  if (node.type === "topic") return 24;
  return 7 + Math.min(8, Math.sqrt((node.video.views ?? 0) + 1));
}

export function ChannelGraph({ data }: { data: GraphData }) {
  const { nodes, links } = useMemo(() => layoutGraph(data), [data]);
  const [selected, setSelected] = useState<string | null>(null);
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const near = selected ? neighborIds(selected, links) : null;
  const current = selected ? byId.get(selected) : null;
  const nextVideo = current?.type === "video" && current.video.next ? byId.get(current.video.next) : null;

  return (
    <section aria-label="How the videos connect" className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pb-2 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-full" style={{ background: TOPIC_COLOR }} />Topic</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full" style={{ background: LANE_COLOR.journey }} />Journey</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full" style={{ background: LANE_COLOR.evergreen }} />Evergreen</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full" style={{ background: LANE_COLOR.bridge }} />Bridge</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block w-4 border-t-2 border-dashed border-slate-500" />Next watch</span>
      </div>
      <svg
        viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
        role="group"
        aria-label="Graph of channel videos, topics, and next-watch links. Tap a dot for details."
        className="h-auto w-full touch-manipulation"
        onClick={() => setSelected(null)}
      >
        <defs>
          <marker id="next-arrow" viewBox="0 -5 10 10" refX={18} refY={0} markerWidth={5} markerHeight={5} orient="auto">
            <path d="M0,-5L10,0L0,5" fill="#64748b" />
          </marker>
        </defs>
        <g aria-hidden="true">
          {links.map((link) => {
            const a = byId.get(link.source)!;
            const b = byId.get(link.target)!;
            const dim = near && !(near.has(link.source) && near.has(link.target));
            return (
              <line
                key={`${link.kind}:${link.source}:${link.target}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={link.kind === "next" ? "#64748b" : "#cbd5e1"}
                strokeWidth={link.kind === "next" ? 1.8 : 1.2}
                strokeDasharray={link.kind === "next" ? "5 4" : undefined}
                markerEnd={link.kind === "next" ? "url(#next-arrow)" : undefined}
                opacity={dim ? 0.08 : 1}
              />
            );
          })}
        </g>
        {nodes.map((node) => {
          const dim = near && !near.has(node.id);
          const isSelected = selected === node.id;
          const fill = node.type === "topic" ? TOPIC_COLOR : LANE_COLOR[node.video.lane];
          const label = node.type === "topic" ? node.name : node.video.title;
          return (
            <g
              key={node.id}
              transform={`translate(${node.x},${node.y})`}
              opacity={dim ? 0.14 : 1}
              role="button"
              tabIndex={0}
              aria-label={node.type === "topic" ? `${node.name} topic` : node.video.title}
              onClick={(event) => {
                event.stopPropagation();
                setSelected(node.id);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelected(node.id);
                }
                if (event.key === "Escape") setSelected(null);
              }}
              className="cursor-pointer outline-none"
            >
              <circle r={Math.max(radius(node), 20)} fill="transparent" />
              <circle r={radius(node)} fill={fill} stroke={isSelected ? "#0f172a" : "#ffffff"} strokeWidth={isSelected ? 3.5 : 1.5} />
              {node.type === "topic" ? (
                <text textAnchor="middle" dy={42} fontSize={20} fontWeight={600} fill="#334155">{label}</text>
              ) : (
                <text
                  dx={13}
                  dy=".35em"
                  fontSize={15}
                  fill="#334155"
                  className={isSelected || near?.has(node.id) ? "" : "hidden md:inline"}
                >
                  {label.length > 34 ? `${label.slice(0, 32)}…` : label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="min-h-16 px-1 pt-2" aria-live="polite">
        {current?.type === "video" ? (
          <div>
            <p className="font-semibold text-slate-900">{current.video.title}</p>
            <p className="mt-0.5 text-sm text-slate-600">
              {current.video.lane}
              {current.video.views == null ? " · not published yet" : ` · ${current.video.views.toLocaleString("en-US")} views`}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {current.video.id.length === 11 ? (
                <a
                  href={`https://www.youtube.com/watch?v=${current.video.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-900"
                >
                  Watch on YouTube
                </a>
              ) : null}
              {nextVideo?.type === "video" ? (
                <button
                  type="button"
                  onClick={() => setSelected(nextVideo.id)}
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-900"
                >
                  Next watch: {nextVideo.video.title.length > 28 ? `${nextVideo.video.title.slice(0, 26)}…` : nextVideo.video.title}
                </button>
              ) : null}
            </div>
          </div>
        ) : current?.type === "topic" ? (
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">{current.name}</span>
            {" · "}
            {links.filter((link) => link.kind === "topic" && link.target === current.id).length} videos
          </p>
        ) : (
          <p className="text-sm text-slate-500">Tap a dot to see the video and where it leads.</p>
        )}
      </div>
    </section>
  );
}

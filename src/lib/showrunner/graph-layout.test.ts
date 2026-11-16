import { describe, expect, it } from "vitest";
import data from "./channel-graph.json";
import { GRAPH_HEIGHT, GRAPH_WIDTH, layoutGraph, neighborIds, type GraphData } from "./graph-layout";

const graph = data as GraphData;

describe("layoutGraph", () => {
  it("places every topic and video inside the picture", () => {
    const { nodes } = layoutGraph(graph);
    expect(nodes).toHaveLength(graph.topics.length + graph.videos.length);
    for (const node of nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(GRAPH_WIDTH);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(GRAPH_HEIGHT);
      expect(Number.isFinite(node.x) && Number.isFinite(node.y)).toBe(true);
    }
  });

  it("gives the same layout every time", () => {
    expect(layoutGraph(graph).nodes.map((n) => [n.id, n.x, n.y])).toEqual(layoutGraph(graph).nodes.map((n) => [n.id, n.x, n.y]));
  });

  it("links each video to its topics and its next watch, and only to videos that exist", () => {
    const { links } = layoutGraph(graph);
    const ids = new Set(graph.videos.map((video) => video.id));
    for (const video of graph.videos) {
      expect(links.filter((l) => l.source === video.id && l.kind === "topic")).toHaveLength(video.topics.length);
      if (video.next) expect(ids.has(video.next)).toBe(true);
    }
  });

  it("selecting a video lights up itself, its topics and its next watch", () => {
    const { links } = layoutGraph(graph);
    const near = neighborIds("AifJV6LJJb8", links);
    expect(near.has("AifJV6LJJb8")).toBe(true);
    expect(near.has("topic:Firm building")).toBe(true);
    expect(near.has("m9F8F2-cB28")).toBe(true);
  });
});

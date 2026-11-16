export type GraphVideo = {
  id: string;
  title: string;
  lane: "journey" | "evergreen" | "bridge";
  views: number | null;
  topics: string[];
  next: string | null;
};

export type GraphData = { topics: string[]; videos: GraphVideo[] };

export type GraphNode =
  | { type: "topic"; id: string; name: string; x: number; y: number }
  | { type: "video"; id: string; video: GraphVideo; x: number; y: number };

export type GraphLink = { source: string; target: string; kind: "topic" | "next" };

export const GRAPH_WIDTH = 1000;
export const GRAPH_HEIGHT = 690;

// A small deterministic layout. Topics sit at fixed spots on a ring, in the
// order given, so related topics are neighbours. Each video starts between its
// topics and is then pushed apart from the other videos, with a light pull
// toward its next watch. The same data always lands in the same place, so the
// picture does not jump between visits and renders the same on the server and
// in the browser.
export function layoutGraph(data: GraphData): { nodes: GraphNode[]; links: GraphLink[] } {
  const ids = new Set(data.videos.map((video) => video.id));
  const cx = GRAPH_WIDTH / 2;
  const cy = GRAPH_HEIGHT / 2 - 12;
  const topicNodes = data.topics.map((name, index): GraphNode => {
    const angle = -Math.PI / 2 + (index / data.topics.length) * Math.PI * 2;
    return { type: "topic", id: `topic:${name}`, name, x: cx + Math.cos(angle) * 360, y: cy + Math.sin(angle) * 235 };
  });
  const topicById = new Map(topicNodes.map((node) => [node.id, node]));

  const anchors = new Map<string, { x: number; y: number }>();
  const videoNodes = data.videos.map((video, index): GraphNode => {
    const spots = video.topics.map((topic) => topicById.get(`topic:${topic}`)).filter((node): node is GraphNode => Boolean(node));
    const ax = spots.length ? spots.reduce((sum, spot) => sum + spot.x, 0) / spots.length : cx;
    const ay = spots.length ? spots.reduce((sum, spot) => sum + spot.y, 0) / spots.length : cy;
    const anchor = { x: cx + (ax - cx) * 0.8, y: cy + (ay - cy) * 0.8 };
    anchors.set(video.id, anchor);
    const angle = index * 2.399963; // golden angle: spreads same-anchor videos
    return { type: "video", id: video.id, video, x: anchor.x + Math.cos(angle) * 26, y: anchor.y + Math.sin(angle) * 26 };
  });
  const nodes: GraphNode[] = [...topicNodes, ...videoNodes];

  const links: GraphLink[] = [];
  for (const video of data.videos) {
    for (const topic of video.topics) links.push({ source: video.id, target: `topic:${topic}`, kind: "topic" });
    if (video.next && ids.has(video.next)) links.push({ source: video.id, target: video.next, kind: "next" });
  }

  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (let step = 0; step < 260; step += 1) {
    const cooling = 1 - step / 260;
    for (let i = 0; i < videoNodes.length; i += 1) {
      const a = videoNodes[i];
      let fx = 0;
      let fy = 0;
      for (let j = 0; j < nodes.length; j += 1) {
        const b = nodes[j];
        if (a === b) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distance = Math.max(Math.hypot(dx, dy), 1);
        const want = b.type === "topic" ? 60 : 54;
        if (distance < want) {
          const push = (want - distance) * 0.22;
          fx += (dx / distance) * push;
          fy += (dy / distance) * push;
        }
      }
      const anchor = anchors.get(a.id)!;
      fx += (anchor.x - a.x) * 0.012;
      fy += (anchor.y - a.y) * 0.012;
      a.x = Math.min(GRAPH_WIDTH - 40, Math.max(40, a.x + fx * cooling * 2));
      a.y = Math.min(GRAPH_HEIGHT - 40, Math.max(40, a.y + fy * cooling * 2));
    }
    for (const link of links) {
      if (link.kind !== "next") continue;
      const a = byId.get(link.source)!;
      const b = byId.get(link.target)!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.max(Math.hypot(dx, dy), 1);
      const pull = Math.max(0, distance - 90) * 0.01 * cooling;
      a.x += (dx / distance) * pull;
      a.y += (dy / distance) * pull;
      b.x -= (dx / distance) * pull;
      b.y -= (dy / distance) * pull;
    }
  }
  return { nodes, links };
}

export function neighborIds(id: string, links: GraphLink[]): Set<string> {
  const ids = new Set([id]);
  for (const link of links) {
    if (link.source === id) ids.add(link.target);
    if (link.target === id) ids.add(link.source);
  }
  return ids;
}

import { timingSafeEqual } from "node:crypto";

/** One autopilot step as ripley reports it. */
export type VideoStep = { label: string; state: "done" | "now" | "todo" | "stopped"; message?: string };

/** The render job's numbers, shown as two bars under the render step. */
export type VideoRender = { total?: number; piece?: number; pieces?: number; pieceShare?: number; minutesLeft?: number };

export type VideoStatusInput = {
  batch: string;
  project: string | null;
  state: string;
  stage: string | null;
  steps: VideoStep[] | null;
  render: VideoRender | null;
  url: string | null;
  sentAt: Date | null;
};

const STEP_STATES = ["done", "now", "todo", "stopped"];
const BATCH = /^[A-Za-z0-9-]{1,60}$/;

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, max) : null;
}

function share(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : undefined;
}

function count(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 100_000 ? value : undefined;
}

/** Checks one row of ripley's queue.json. Returns null for a row that is not usable. */
export function parseVideoStatus(raw: unknown): VideoStatusInput | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const batch = typeof row.batch === "string" && BATCH.test(row.batch) ? row.batch : null;
  const state = text(row.state, 40);
  if (!batch || !state) return null;
  const steps = Array.isArray(row.steps)
    ? row.steps.slice(0, 30).flatMap((step): VideoStep[] => {
        if (!step || typeof step !== "object") return [];
        const s = step as Record<string, unknown>;
        const label = text(s.label, 120);
        if (!label || typeof s.state !== "string" || !STEP_STATES.includes(s.state)) return [];
        const message = text(s.message, 500);
        return [{ label, state: s.state as VideoStep["state"], ...(message ? { message } : {}) }];
      })
    : null;
  let render: VideoRender | null = null;
  if (row.render && typeof row.render === "object") {
    const r = row.render as Record<string, unknown>;
    render = { total: share(r.total), piece: count(r.piece), pieces: count(r.pieces), pieceShare: share(r.pieceShare), minutesLeft: count(r.minutesLeft) };
    if (render.total === undefined) render = null;
  }
  const url = typeof row.url === "string" && row.url.startsWith("https://") ? row.url.slice(0, 300) : null;
  const created = typeof row.created === "number" && row.created > 0 ? new Date(row.created * 1000) : null;
  return {
    batch,
    project: text(row.project, 200),
    state,
    stage: text(row.stage ?? row.message, 1000),
    steps: steps && steps.length > 0 ? steps : null,
    render,
    url,
    sentAt: created && !Number.isNaN(created.getTime()) ? created : null,
  };
}

/** The push token from ripley, compared in constant time. 503 when this SWapp has no token set. */
export function checkStatusToken(
  header: string | null,
  env: Record<string, string | undefined> = process.env,
): { ok: true; actorUserId: string } | { ok: false; status: 401 | 503 } {
  const token = env.SHOWRUNNER_STATUS_TOKEN ?? "";
  // No database policy reads the actor; it only names who wrote the row.
  const actorUserId = env.SHOWRUNNER_STATUS_ACTOR_USER_ID || "showrunner-ripley";
  if (token.length < 32) return { ok: false, status: 503 };
  const given = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, status: 401 };
  return { ok: true, actorUserId };
}

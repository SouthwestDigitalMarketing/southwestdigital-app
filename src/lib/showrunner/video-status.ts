import { timingSafeEqual } from "node:crypto";

/** One autopilot step as ripley reports it. */
export type VideoStep = { label: string; state: "done" | "now" | "todo" | "stopped"; message?: string };

/**
 * The current step's numbers, shown as two bars under it. `pieceLabel` names the unit
 * ("Graphic" → "Graphic 12 of 50"; default "Piece") and `pieceName` the one in progress ("Lower third").
 */
export type VideoRender = {
  total?: number;
  piece?: number;
  pieces?: number;
  pieceShare?: number;
  minutesLeft?: number;
  pieceLabel?: string;
  pieceName?: string;
};

/** Facts about the episode, filled in as the autopilot learns them. */
export type VideoDetails = { lengthSeconds?: number; graphics?: number; quickbooksScreens?: number };

/** One timed line of the talking-head transcript, for highlighting a teaser. */
export type TranscriptCue = { start: number; end: number; text: string };

/** Teaser before the title screen. `wanted` false means start on the title. */
export type Teaser = { wanted: boolean; start: number | null; end: number | null; text: string | null };

/** YouTube privacy as shown on the episode card. */
export const YOUTUBE_VISIBILITY = ["private", "unlisted", "public", "scheduled"] as const;
export type YoutubeVisibility = (typeof YOUTUBE_VISIBILITY)[number];

export function parseVisibility(value: unknown): YoutubeVisibility | null {
  return typeof value === "string" && (YOUTUBE_VISIBILITY as readonly string[]).includes(value)
    ? (value as YoutubeVisibility)
    : null;
}

export function youtubeVisibilityLabel(visibility: YoutubeVisibility | null, hasUrl: boolean): string | null {
  if (!hasUrl && !visibility) return null;
  if (visibility === "private") return "Private on YouTube";
  if (visibility === "unlisted") return "Unlisted on YouTube";
  if (visibility === "public") return "Public on YouTube";
  if (visibility === "scheduled") return "Scheduled on YouTube";
  return "On YouTube";
}

/** A JPEG thumbnail sent inline by ripley. */
export const THUMBNAIL_PREFIX = "data:image/jpeg;base64,";
const THUMBNAIL_MAX = 200 * 1024;

export type TitleScreenKind = "daily" | "series";

export type VideoStatusInput = {
  batch: string;
  project: string | null;
  state: string;
  stage: string | null;
  steps: VideoStep[] | null;
  render: VideoRender | null;
  url: string | null;
  title: string | null;
  thumbnail: string | null;
  details: VideoDetails | null;
  transcript: string | null;
  thumbnailText: string | null;
  thumbnailOptions: string[] | null;
  thumbnailBusy: boolean;
  transcriptCues: TranscriptCue[] | null;
  teaser: Teaser | null;
  teaserBusy: boolean;
  visibility: YoutubeVisibility | null;
  visibilityBusy: boolean;
  titleScreen: string | null;
  titleScreenKind: TitleScreenKind | null;
  titleScreenDay: number | null;
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
    render = {
      total: share(r.total),
      piece: count(r.piece),
      pieces: count(r.pieces),
      pieceShare: share(r.pieceShare),
      minutesLeft: count(r.minutesLeft),
      pieceLabel: text(r.pieceLabel, 30) ?? undefined,
      pieceName: text(r.pieceName, 80) ?? undefined,
    };
    if (render.total === undefined) render = null;
  }
  const url = typeof row.url === "string" && row.url.startsWith("https://") ? row.url.slice(0, 300) : null;
  const thumbnail = jpeg(row.thumbnail);
  const titleScreen = jpeg(row.titleScreen);
  let details: VideoDetails | null = null;
  if (row.details && typeof row.details === "object") {
    const d = row.details as Record<string, unknown>;
    const picked = { lengthSeconds: count(d.lengthSeconds), graphics: count(d.graphics), quickbooksScreens: count(d.quickbooksScreens) };
    const kept = Object.fromEntries(Object.entries(picked).filter(([, value]) => value !== undefined)) as VideoDetails;
    details = Object.keys(kept).length > 0 ? kept : null;
  }
  const created = typeof row.created === "number" && row.created > 0 ? new Date(row.created * 1000) : null;
  const transcriptCues = Array.isArray(row.transcriptCues)
    ? row.transcriptCues.slice(0, 400).flatMap((cue): TranscriptCue[] => {
        if (!cue || typeof cue !== "object") return [];
        const item = cue as Record<string, unknown>;
        const start = typeof item.start === "number" && Number.isFinite(item.start) ? item.start : null;
        const end = typeof item.end === "number" && Number.isFinite(item.end) ? item.end : null;
        const cueText = text(item.text, 280);
        if (start === null || end === null || end <= start || !cueText) return [];
        return [{ start, end, text: cueText }];
      })
    : null;
  let teaser: Teaser | null = null;
  if (row.teaser && typeof row.teaser === "object") {
    const item = row.teaser as Record<string, unknown>;
    if (typeof item.wanted === "boolean") {
      teaser = {
        wanted: item.wanted,
        start: typeof item.start === "number" && Number.isFinite(item.start) ? item.start : null,
        end: typeof item.end === "number" && Number.isFinite(item.end) ? item.end : null,
        text: text(item.text, 2000),
      };
    }
  }
  const thumbnailOptions = Array.isArray(row.thumbnailOptions)
    ? row.thumbnailOptions
        .slice(0, 8)
        .flatMap((option) => {
          const value = text(option, 80);
          return value ? [value] : [];
        })
    : null;
  return {
    batch,
    project: text(row.project, 200),
    state,
    stage: text(row.stage ?? row.message, 1000),
    steps: steps && steps.length > 0 ? steps : null,
    render,
    url,
    title: text(row.title, 200),
    thumbnail,
    details,
    transcript: text(row.transcript, 80_000),
    thumbnailText: text(row.thumbnailText, 80),
    thumbnailOptions: thumbnailOptions && thumbnailOptions.length > 0 ? thumbnailOptions : null,
    thumbnailBusy: row.thumbnailBusy === true,
    transcriptCues: transcriptCues && transcriptCues.length > 0 ? transcriptCues : null,
    teaser,
    teaserBusy: row.teaserBusy === true,
    visibility: parseVisibility(row.visibility),
    visibilityBusy: row.visibilityBusy === true,
    titleScreen,
    titleScreenKind: row.titleScreenKind === "daily" || row.titleScreenKind === "series" ? row.titleScreenKind : null,
    titleScreenDay: count(row.titleScreenDay) ?? null,
    sentAt: created && !Number.isNaN(created.getTime()) ? created : null,
  };
}

function jpeg(value: unknown): string | null {
  return typeof value === "string" &&
    value.startsWith(THUMBNAIL_PREFIX) &&
    value.length <= THUMBNAIL_MAX &&
    /^[A-Za-z0-9+/=]+$/.test(value.slice(THUMBNAIL_PREFIX.length))
    ? value
    : null;
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

export const REACTIONS = ["like", "drop", "change"] as const;
export type Reaction = (typeof REACTIONS)[number];

export const REACTION_LABEL: Record<Reaction, string> = {
  like: "Liked",
  drop: "Dropped",
  change: "Wants a change",
};

export type FeedbackInput = {
  seriesSlug: string;
  episodeIndex: number | null;
  reaction: Reaction;
  note: string | null;
};

export const NOTE_MAX = 2000;

/** Checks what the browser sent. Returns null for anything that is not a valid reaction. */
export function parseFeedbackInput(
  raw: { seriesSlug?: unknown; episodeIndex?: unknown; reaction?: unknown; note?: unknown },
  episodeCount: number,
): FeedbackInput | null {
  if (typeof raw.seriesSlug !== "string" || raw.seriesSlug.length === 0 || raw.seriesSlug.length > 100) return null;
  if (typeof raw.reaction !== "string" || !(REACTIONS as readonly string[]).includes(raw.reaction)) return null;
  let episodeIndex: number | null = null;
  if (raw.episodeIndex !== null && raw.episodeIndex !== undefined) {
    if (typeof raw.episodeIndex !== "number" || !Number.isInteger(raw.episodeIndex)) return null;
    if (raw.episodeIndex < 0 || raw.episodeIndex >= episodeCount) return null;
    episodeIndex = raw.episodeIndex;
  }
  let note: string | null = null;
  if (raw.note !== null && raw.note !== undefined) {
    if (typeof raw.note !== "string") return null;
    const trimmed = raw.note.trim();
    if (trimmed.length > NOTE_MAX) return null;
    note = trimmed.length > 0 ? trimmed : null;
  }
  return { seriesSlug: raw.seriesSlug, episodeIndex, reaction: raw.reaction as Reaction, note };
}

export type LatestFeedback = { reaction: Reaction; note: string | null };

/** The newest reaction for the series itself (key "series") and for each episode (key "ep:N"). */
export function latestByTarget(
  rows: Array<{ episodeIndex: number | null; reaction: string; note: string | null; createdAt: Date }>,
): Record<string, LatestFeedback> {
  const out: Record<string, LatestFeedback> = {};
  const sorted = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const row of sorted) {
    if (!(REACTIONS as readonly string[]).includes(row.reaction)) continue;
    const key = row.episodeIndex === null ? "series" : `ep:${row.episodeIndex}`;
    out[key] = { reaction: row.reaction as Reaction, note: row.note };
  }
  return out;
}

/**
 * The Sunday wrap-up week (Tom, 2026-11-24). Ripley's showrunner_weekly.py gathers the week's
 * numbers, writes Tom's talking points and picks clips from the daily videos, then pushes it here.
 * Only counts and plain descriptions arrive; ripley checks out client and lead names first.
 */
export type WeekFact = { key: string; label: string; value: number | string; source: string; detail: string };
export type WeekClip = { title: string; videoId: string | null; start: number; end: number; why: string };
export type Week = {
  release: string;
  window: [string, string];
  title: string;
  question: string;
  talkingPoints: string[];
  facts: WeekFact[];
  clips: WeekClip[];
  hookNext: string;
  preparedAt: string | null;
};

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const isDate = (value: string) => value !== "" && !Number.isNaN(Date.parse(value));

/** Holds a pushed week to its shape; anything unreadable is dropped, and no release means no week. */
export function parseWeek(raw: unknown): Week | null {
  if (!raw || typeof raw !== "object") return null;
  const w = raw as Record<string, unknown>;
  const release = text(w.release, 40);
  if (!isDate(release)) return null;
  const windowRaw = Array.isArray(w.window) ? w.window.map((v) => text(v, 40)) : [];
  const facts = (Array.isArray(w.facts) ? w.facts : []).slice(0, 20).flatMap((f): WeekFact[] => {
    if (!f || typeof f !== "object") return [];
    const r = f as Record<string, unknown>;
    const label = text(r.label, 60);
    const value = typeof r.value === "number" && Number.isFinite(r.value) ? r.value : text(r.value, 40);
    if (!label || value === "") return [];
    return [{ key: text(r.key, 30), label, value, source: text(r.source, 40), detail: text(r.detail, 200) }];
  });
  const talkingPoints = (Array.isArray(w.talkingPoints) ? w.talkingPoints : []).slice(0, 12).flatMap((p) => {
    const say = typeof p === "string" ? text(p, 300) : text((p as Record<string, unknown> | null)?.say, 300);
    return say ? [say] : [];
  });
  const clips = (Array.isArray(w.clips) ? w.clips : []).slice(0, 8).flatMap((c): WeekClip[] => {
    if (!c || typeof c !== "object") return [];
    const r = c as Record<string, unknown>;
    const start = Number(r.start), end = Number(r.end);
    const title = text(r.title, 120);
    if (!title || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
    const videoId = text(r.videoId, 20);
    return [{ title, videoId: /^[\w-]{6,20}$/.test(videoId) ? videoId : null, start, end, why: text(r.why, 160) }];
  });
  return {
    release,
    window: windowRaw.length === 2 && windowRaw.every(isDate) ? [windowRaw[0], windowRaw[1]] : ["", ""],
    title: text(w.title, 120),
    question: text(w.question, 160),
    talkingPoints,
    facts,
    clips,
    hookNext: text(w.hookNext, 160),
    preparedAt: isDate(text(w.preparedAt, 40)) ? text(w.preparedAt, 40) : null,
  };
}

/** "Sun Nov 29, 5:00 PM" in Central time. */
export function releaseLabel(release: string): string {
  return new Date(release).toLocaleString("en-US", {
    timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export function clipLength(clip: WeekClip): string {
  const seconds = Math.round(clip.end - clip.start);
  return seconds >= 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : `${seconds}s`;
}

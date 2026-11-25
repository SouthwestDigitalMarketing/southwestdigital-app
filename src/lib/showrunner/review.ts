/**
 * The video scorecard ripley writes for each published video (showrunner_review.py; All Thing
 * sops/sop-video-scorecard.md, Tom 2026-11-25): 16 items worth 100 points, then what to fix now and next time.
 */
export type ReviewItem = { id: string; title: string; points: number; max: number; reason: string; at: string };

export type VideoReview = {
  reviewedAt: string;
  videoId: string | null;
  title: string;
  score: number;
  items: ReviewItem[];
  fixNow: { title: string; thumbnailText: string; notes: string[] };
  nextTime: string;
};

/** The scorecard's sections, in order, by item id. */
export const REVIEW_SECTIONS: { name: string; ids: string[] }[] = [
  { name: "Title and thumbnail", ids: ["1", "2", "3", "4", "5"] },
  { name: "Opening", ids: ["A", "B", "C", "7", "9"] },
  { name: "Middle and end", ids: ["10", "11", "12", "13", "14", "15"] },
];

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function count(value: unknown, most: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(most, Math.round(value))) : 0;
}

/** Checks a review from ripley. Returns null when it is not usable. */
export function parseReview(raw: unknown): VideoReview | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.items) || r.items.length === 0) return null;
  const items = r.items.slice(0, 30).flatMap((value): ReviewItem[] => {
    if (!value || typeof value !== "object") return [];
    const i = value as Record<string, unknown>;
    const id = text(i.id, 8);
    const max = count(i.max, 100);
    if (!id || max === 0) return [];
    return [{ id, title: text(i.title, 120), points: count(i.points, max), max, reason: text(i.reason, 500), at: text(i.at, 10) }];
  });
  if (items.length === 0) return null;
  const fix = (r.fixNow && typeof r.fixNow === "object" ? r.fixNow : {}) as Record<string, unknown>;
  const reviewedAt = text(r.reviewedAt, 40);
  return {
    reviewedAt: Number.isNaN(Date.parse(reviewedAt)) ? new Date().toISOString() : reviewedAt,
    videoId: text(r.videoId, 20) || null,
    title: text(r.title, 200),
    score: items.reduce((sum, item) => sum + item.points, 0),
    items,
    fixNow: {
      title: text(fix.title, 100),
      thumbnailText: text(fix.thumbnailText, 60),
      notes: Array.isArray(fix.notes) ? fix.notes.slice(0, 5).map((n) => text(n, 300)).filter(Boolean) : [],
    },
    nextTime: text(r.nextTime, 500),
  };
}

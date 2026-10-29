export const PROPOSAL_VIEW_EVENT_TYPES = [
  "view",
  "step",
  "scroll_depth",
  "package_seen",
  "package_select",
  "video_play",
  "leave",
] as const;

export type ProposalViewEventType = (typeof PROPOSAL_VIEW_EVENT_TYPES)[number];

export type ProposalViewEventInput = {
  type: ProposalViewEventType;
  step?: number | null;
  packageId?: string | null;
  position?: number | null;
  value?: number | null;
};

export const MAX_EVENTS_PER_REQUEST = 40;
const MAX_ID_LENGTH = 64;

function boundedInt(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function shortId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= MAX_ID_LENGTH && /^[\w-]+$/.test(trimmed) ? trimmed : null;
}

export function sanitizeSessionId(value: unknown): string | null {
  return shortId(value);
}

/** Keeps only known event types and bounded values; unknown input is dropped, never stored. */
export function sanitizeViewEvents(raw: unknown): ProposalViewEventInput[] {
  if (!Array.isArray(raw)) return [];
  const events: ProposalViewEventInput[] = [];
  for (const item of raw.slice(0, MAX_EVENTS_PER_REQUEST)) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    const type = PROPOSAL_VIEW_EVENT_TYPES.find((known) => known === candidate.type);
    if (!type) continue;
    events.push({
      type,
      step: boundedInt(candidate.step, 0, 10),
      packageId: shortId(candidate.packageId),
      position: boundedInt(candidate.position, 0, 20),
      value: boundedInt(candidate.value, 0, 86_400_000),
    });
  }
  return events;
}

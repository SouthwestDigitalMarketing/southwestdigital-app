// What each support level means, in plain words. Keyed by the catalog's support service name;
// a name not listed here falls back to the service's own name and description.
export const SERVICE_LEVEL_COPY: Record<string, { title: string; meaning: string; /** The time promise inside meaning; shown bold. */ emphasis: string }> = {
  "Standard Client Support": { title: "Steady Support", meaning: "Ask us anything about your books. We reply within 2–3 business days.", emphasis: "2–3 business days" },
  "Priority Client Support": { title: "Fast-Lane Support", meaning: "Skip the wait. We reply to your questions and requests the same business day.", emphasis: "same business day" },
  "Concierge Client Support": { title: "White-Glove Concierge", meaning: "We're on call for you, 24/7, for bookkeeping questions and anything time-sensitive.", emphasis: "24/7" },
};

// One support level's frozen display copy.
export type SupportLevelCopy = { title: string; meaning: string; /** The time promise inside meaning; shown bold. */ emphasis: string };

// The support copy stored on a quote snapshot at publish time, so accepted/old
// proposals render exactly what the client saw. Version 1 is the legacy wording
// (identical to LEGACY_SUPPORT_COPY); version 2 is the current wording below.
export type StoredSupportCopy = { version: number; levels: Record<string, SupportLevelCopy> };

// Frozen pre-Spec-07 wording. Byte-equal to SERVICE_LEVEL_COPY as it read when
// Spec 07 was built, so snapshots without stored copy render exactly as before.
// Do not edit: new wording goes in SUPPORT_COPY.
export const LEGACY_SUPPORT_COPY: Record<string, SupportLevelCopy> = {
  "Standard Client Support": { title: "Steady Support", meaning: "Ask us anything about your books. We reply within 2–3 business days.", emphasis: "2–3 business days" },
  "Priority Client Support": { title: "Fast-Lane Support", meaning: "Skip the wait. We reply to your questions and requests the same business day.", emphasis: "same business day" },
  "Concierge Client Support": { title: "White-Glove Concierge", meaning: "We're on call for you, 24/7, for bookkeeping questions and anything time-sensitive.", emphasis: "24/7" },
};

// Current wording for newly published quotes. Standard/Priority match legacy;
// Concierge no longer promises 24/7.
export const SUPPORT_COPY: Record<string, SupportLevelCopy> = {
  "Standard Client Support": { title: "Steady Support", meaning: "Ask us anything about your books. We reply within 2–3 business days.", emphasis: "2–3 business days" },
  "Priority Client Support": { title: "Fast-Lane Support", meaning: "Skip the wait. We reply to your questions and requests the same business day.", emphasis: "same business day" },
  "Concierge Client Support": { title: "White-Glove Concierge", meaning: "We reply within 2 business hours (Mon–Fri, 9–5 Central), and you get a direct line for anything time-sensitive.", emphasis: "2 business hours" },
};

// Version stamped by supportCopyForPublish().
export const SUPPORT_COPY_VERSION = 2;
// Version used for the legacy fallback from resolveSupportCopy().
export const LEGACY_SUPPORT_COPY_VERSION = 1;

function copyLevels(levels: Record<string, SupportLevelCopy>): Record<string, SupportLevelCopy> {
  return Object.fromEntries(Object.entries(levels).map(([name, copy]) => [name, { ...copy }]));
}

function isSupportLevelCopy(value: unknown): value is SupportLevelCopy {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.title === "string" && typeof entry.meaning === "string" && typeof entry.emphasis === "string";
}

// The copy to store on a quote snapshot at publish time (current wording).
export function supportCopyForPublish(): StoredSupportCopy {
  return { version: SUPPORT_COPY_VERSION, levels: copyLevels(SUPPORT_COPY) };
}

// True when a snapshot carries its own frozen support copy (a Spec 07
// publish). Snapshots without one render the legacy map and, for the
// agreement, omit the WHAT'S INCLUDED section so old text stays byte-identical.
export function hasStoredSupportCopy(stored: unknown): boolean {
  if (typeof stored !== "object" || stored === null) return false;
  const candidate = stored as { version?: unknown; levels?: unknown };
  if (typeof candidate.version !== "number" || !Number.isFinite(candidate.version)) return false;
  if (typeof candidate.levels !== "object" || candidate.levels === null) return false;
  const entries = Object.entries(candidate.levels as Record<string, unknown>);
  return entries.length > 0 && entries.every(([, copy]) => isSupportLevelCopy(copy));
}

// The stored copy for rendering a snapshot. Returns the stored copy when it is
// a well-formed { version, levels } map, else the frozen legacy copy — never
// the current wording, so snapshots without copy look exactly as before.
export function resolveSupportCopy(stored: unknown): StoredSupportCopy {
  if (typeof stored === "object" && stored !== null) {
    const candidate = stored as { version?: unknown; levels?: unknown };
    if (typeof candidate.version === "number" && Number.isFinite(candidate.version)
      && typeof candidate.levels === "object" && candidate.levels !== null) {
      const levels = candidate.levels as Record<string, unknown>;
      const entries = Object.entries(levels);
      if (entries.length > 0 && entries.every(([, copy]) => isSupportLevelCopy(copy))) {
        return { version: candidate.version, levels: copyLevels(levels as Record<string, SupportLevelCopy>) };
      }
    }
  }
  return { version: LEGACY_SUPPORT_COPY_VERSION, levels: copyLevels(LEGACY_SUPPORT_COPY) };
}

function levelsFor(copy: StoredSupportCopy | undefined): Record<string, SupportLevelCopy> {
  return copy === undefined ? SERVICE_LEVEL_COPY : resolveSupportCopy(copy).levels;
}

// Splits a meaning around its time promise so the caller can bold the middle part.
export function splitServiceLevelMeaning(meaning: string, emphasis: string) {
  const at = meaning.indexOf(emphasis);
  return at < 0 ? null : { before: meaning.slice(0, at), emphasis, after: meaning.slice(at + emphasis.length) };
}

// The name a client sees. Used everywhere the support level is listed (service level box,
// included list, agreement) so one level never appears under two names.
// Pass a snapshot's resolved copy to render frozen wording; omitting it keeps
// today's behavior (legacy map) for callers the next builder has not switched yet.
export function serviceLevelTitle(serviceName: string, copy?: StoredSupportCopy) {
  return levelsFor(copy)[serviceName]?.title ?? serviceName;
}

// Stored-copy wording for a support level, looked up by catalog name or display
// title; else the stored text. Pass a snapshot's resolved copy to render frozen
// wording; omitting it keeps today's behavior (legacy map) for callers not yet switched.
export function serviceLevelDescription(serviceName: string, fallback: string, copy?: StoredSupportCopy) {
  const levels = levelsFor(copy);
  const entry = levels[serviceName] ?? Object.values(levels).find((level) => level.title === serviceName);
  return entry?.meaning ?? fallback;
}

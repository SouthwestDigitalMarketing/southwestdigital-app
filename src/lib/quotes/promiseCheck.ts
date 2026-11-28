// Promise scanner (pure): flags free-text proposal wording that can contradict
// the service agreement (tax filing, CPA, audit, 24/7, unlimited, guarantee,
// same-day). The builder blocks publish/send until each hit is edited or
// confirmed ("keep this wording"); confirmations live on the quote.

export type PromiseField = { where: string; text: string };

export type PromiseHit = {
  where: string;
  /** Canonical pattern name, e.g. "same day" for a "same-day" match. */
  phrase: string;
  /** The exact text that matched. */
  match: string;
  /** Offset of the match within the field text. */
  index: number;
  /** Match with ~40 chars of surrounding context. */
  snippet: string;
  /** Hash of the full field text at scan time; confirmations only count while this matches. */
  textHash: string;
};

export type PromiseConfirmation = {
  where: string;
  phrase: string;
  textHash: string;
  confirmedAt: string;
  confirmedBy?: string;
};

// Deterministic FNV-1a hash (hex) of a field's text. Stored on hits and on
// confirmations so a confirmation stops counting once the text is edited.
export function hashPromiseText(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

// Canonical phrase -> pattern. All case-insensitive. Audit covers only
// audit/audits/audited (not auditor/auditing/auditorium); CPA needs a word
// boundary on both sides. "24-7" (hyphen) is not flagged, only slash/x forms.
const PROMISE_PATTERNS: Array<{ phrase: string; pattern: RegExp }> = [
  { phrase: "24/7", pattern: /24\s*\/\s*7|24\s*x\s*7/i },
  { phrase: "unlimited", pattern: /\bunlimited\b/i },
  { phrase: "guarantee", pattern: /\bguarantee[sd]?\b/i },
  { phrase: "same day", pattern: /\bsame[\s-]+day\b/i },
  { phrase: "tax filing", pattern: /\btax\s+filing\b/i },
  { phrase: "file your taxes", pattern: /\bfile\s+your\s+taxes\b/i },
  { phrase: "file taxes", pattern: /\bfile\s+taxes\b/i },
  { phrase: "audit", pattern: /\baudit(?:s|ed)?\b/i },
  { phrase: "CPA", pattern: /\bcpa\b/i },
];

const SNIPPET_RADIUS = 40;

function snippetFor(text: string, index: number, length: number): string {
  const start = Math.max(0, index - SNIPPET_RADIUS);
  const end = Math.min(text.length, index + length + SNIPPET_RADIUS);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

export function scanPromiseRisks(fields: Array<{ where: string; text: string }>): PromiseHit[] {
  const hits: Array<PromiseHit & { fieldOrder: number }> = [];
  fields.forEach((field, fieldOrder) => {
    if (typeof field?.text !== "string" || field.text.length === 0) return;
    const textHash = hashPromiseText(field.text);
    for (const { phrase, pattern } of PROMISE_PATTERNS) {
      const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
      for (const match of field.text.matchAll(global)) {
        const index = match.index ?? 0;
        hits.push({ where: field.where, phrase, match: match[0], index, snippet: snippetFor(field.text, index, match[0].length), textHash, fieldOrder });
      }
    }
  });
  return hits
    .sort((a, b) => a.fieldOrder - b.fieldOrder || a.index - b.index || (a.phrase < b.phrase ? -1 : 1))
    .map((hit): PromiseHit => ({ where: hit.where, phrase: hit.phrase, match: hit.match, index: hit.index, snippet: hit.snippet, textHash: hit.textHash }));
}

// Hits with no confirmation keeping the exact (place, phrase, text) they were
// scanned from. Editing the field text changes its hash, so the old
// confirmation stops counting and the hit surfaces again.
export function unresolvedPromiseHits(hits: PromiseHit[], confirmations: PromiseConfirmation[]): PromiseHit[] {
  return hits.filter((hit) => !confirmations.some(
    (confirmation) => confirmation.where === hit.where
      && confirmation.phrase === hit.phrase
      && confirmation.textHash === hit.textHash,
  ));
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function textOf(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

// Frozen client-facing bonus/option descriptions, stamped at publish time and
// keyed by option id. New publishes freeze the descriptions as they render
// (after the catalog remap); the public payload and this scan read the frozen
// copy when present, so a later catalog edit cannot move client-facing text
// (or the scan) without a republish. Snapshots without the key keep the live
// remap. Only non-archived items with a description are frozen.
export type RenderedOptionCopy = Record<string, string>;

export function renderedOptionCopyForAssessment(assessmentValue: unknown): RenderedOptionCopy {
  const assessment = record(assessmentValue);
  const copy: RenderedOptionCopy = {};
  for (const item of [...records(assessment.bonuses), ...records(assessment.additionalOptions)]) {
    if (typeof item.id !== "string" || item.id.length === 0) continue;
    if (item.archived === true) continue;
    const description = textOf(item.description);
    if (description) copy[item.id] = description;
  }
  return copy;
}

// Reads the frozen copy back: anything missing, malformed, or empty means
// "no frozen copy" and the caller keeps the live remap.
export function readRenderedOptionCopy(snapshotValue: unknown): RenderedOptionCopy | null {
  const stored = record(snapshotValue).renderedOptionCopy;
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return null;
  const copy: RenderedOptionCopy = {};
  for (const [id, description] of Object.entries(stored as Record<string, unknown>)) {
    if (typeof description === "string" && description.length > 0) copy[id] = description;
  }
  return Object.keys(copy).length > 0 ? copy : null;
}

// Every staff-editable CLIENT-FACING free-text surface the promise check
// scans: the intro and the bonus/additional-option descriptions. The
// internal-only notes (assessmentNotes, discretionaryMultiplierNote) never
// reach the public proposal (stripped by the public zod schema), so scanning
// them only blocks publish over wording no client will see. Cover-letter
// email/SMS bodies are ephemeral (never stored in the snapshot), so the
// caller appends them as { where, text } fields.
//
// When the snapshot carries a frozen renderedOptionCopy, option descriptions
// scan as frozen (exactly what the public page renders); otherwise they scan
// as stored.
export function collectPromiseFieldsFromAssessment(
  assessmentValue: unknown,
  renderedCopy?: RenderedOptionCopy | null,
): PromiseField[] {
  const assessment = record(assessmentValue);
  const fields: PromiseField[] = [];
  const introHeadline = textOf(assessment.introHeadline);
  if (introHeadline) fields.push({ where: "Intro headline", text: introHeadline });
  const introBody = textOf(assessment.introBody);
  if (introBody) fields.push({ where: "Intro body", text: introBody });
  for (const item of records(assessment.bonuses)) {
    if (item.archived === true) continue;
    const id = typeof item.id === "string" && item.id.length > 0 ? item.id : null;
    const description = (id && renderedCopy?.[id]) || textOf(item.description);
    if (!description) continue;
    const name = typeof item.name === "string" && item.name ? item.name : String(item.id ?? "bonus");
    fields.push({ where: `Bonus: ${name}`, text: description });
  }
  for (const item of records(assessment.additionalOptions)) {
    if (item.archived === true) continue;
    const id = typeof item.id === "string" && item.id.length > 0 ? item.id : null;
    const description = (id && renderedCopy?.[id]) || textOf(item.description);
    if (!description) continue;
    const name = typeof item.name === "string" && item.name ? item.name : String(item.id ?? "option");
    fields.push({ where: `Additional option: ${name}`, text: description });
  }
  return fields;
}

function isPromiseConfirmation(value: unknown): value is PromiseConfirmation {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.where === "string"
    && typeof entry.phrase === "string"
    && typeof entry.textHash === "string"
    && typeof entry.confirmedAt === "string";
}

// "Keep this wording" confirmations stored on the quote snapshot
// (`snapshot.promiseConfirmations`, no migration). Anything malformed reads
// as no confirmation, so publish/send stay blocked.
export function readPromiseConfirmations(snapshotValue: unknown): PromiseConfirmation[] {
  const snapshot = record(snapshotValue);
  const raw = snapshot.promiseConfirmations;
  if (!Array.isArray(raw)) return [];
  return raw.filter(isPromiseConfirmation).map((entry) => ({
    where: entry.where,
    phrase: entry.phrase,
    textHash: entry.textHash,
    confirmedAt: entry.confirmedAt,
    ...(typeof entry.confirmedBy === "string" ? { confirmedBy: entry.confirmedBy } : {}),
  }));
}

export function validatePromiseConfirmations(value: unknown): PromiseConfirmation[] {
  return Array.isArray(value) ? value.filter(isPromiseConfirmation) : [];
}

// Every unresolved hit for a stored snapshot: the assessment free text (as
// frozen when the snapshot carries a renderedOptionCopy) plus any
// caller-supplied ephemeral fields (cover-letter bodies), against the
// snapshot's "Keep this wording" confirmations.
export function unresolvedSnapshotPromiseHits(snapshotValue: unknown, extraFields: PromiseField[] = []): PromiseHit[] {
  const snapshot = record(snapshotValue);
  return unresolvedPromiseHits(
    scanPromiseRisks([
      ...collectPromiseFieldsFromAssessment(snapshot.assessment, readRenderedOptionCopy(snapshot)),
      ...extraFields,
    ]),
    readPromiseConfirmations(snapshot),
  );
}

// Send paths (mark sent, resend, email) serve the PUBLISHED snapshot while
// sends stamp the draft, so the send gate scans the published snapshot —
// falling back to the draft only when nothing was ever published (or the
// stored value is a database null rather than a snapshot object).
export function publishedOrDraftSnapshot(quote: {
  snapshotJson?: unknown;
  publishedSnapshotJson?: unknown;
}): unknown {
  const published = quote?.publishedSnapshotJson;
  if (
    published
    && typeof published === "object"
    && !Array.isArray(published)
    && Object.keys(published as Record<string, unknown>).length > 0
  ) {
    return published;
  }
  return quote?.snapshotJson ?? null;
}

// Thrown (and mapped to a 409 with the message) when publish/send refuses
// over unresolved promise hits. Carries no state — the message names the fix.
export class PromiseBlockedError extends Error {}

// The server-side publish/send refusal. Names each unresolved hit's place so
// staff know what to edit or confirm in the finalize step.
export function promiseBlockMessage(unresolved: PromiseHit[]): string {
  const places = [...new Set(unresolved.map((hit) => hit.where))];
  return `This proposal has wording that may promise more than the agreement covers (${places.join("; ")}). `
    + "Edit the flagged text or confirm “Keep this wording” in the finalize step before publishing or sending.";
}

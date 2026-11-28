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

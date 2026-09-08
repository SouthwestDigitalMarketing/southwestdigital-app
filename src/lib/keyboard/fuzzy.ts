/**
 * Fuzzy subsequence matching for the command palette.
 *
 * Written by hand rather than pulled from a package: the palette is the one
 * surface a keyboard-first user hits constantly, the algorithm is small, and a
 * dependency here would be a new bundle cost on every authenticated page.
 */

export type FuzzyMatch = {
  score: number;
  /** Indices into the haystack that matched, for highlight rendering. */
  indices: number[];
};

const WORD_BOUNDARY = /[\s\-_/.:()[\]]/;

/** Scoring weights. Tuned so that acronym and prefix hits beat scattered ones. */
const SCORE_MATCH = 16;
const SCORE_CONSECUTIVE = 22;
const SCORE_WORD_START = 18;
const SCORE_CAMEL_START = 14;
const PENALTY_LEADING = -3;
const PENALTY_GAP = -2;
const MAX_LEADING_PENALTY = -18;

function isWordStart(haystack: string, index: number): boolean {
  if (index === 0) return true;
  return WORD_BOUNDARY.test(haystack[index - 1]);
}

function isCamelStart(haystack: string, index: number): boolean {
  if (index === 0) return false;
  const previous = haystack[index - 1];
  const current = haystack[index];
  return previous === previous.toLowerCase() && current === current.toUpperCase() && /[a-z]/i.test(current);
}

/**
 * Greedy left-to-right subsequence match.
 *
 * Greedy is the right trade here: command titles are short, and taking the
 * earliest match for each needle character keeps this O(n) instead of the
 * exponential backtracking a "best possible alignment" search would need.
 * The word-start and consecutive bonuses recover most of what backtracking
 * would buy.
 */
export function fuzzyMatch(haystack: string, needle: string): FuzzyMatch | null {
  if (needle === "") return { score: 1, indices: [] };
  if (haystack === "") return null;

  const lowerHaystack = haystack.toLowerCase();
  const lowerNeedle = needle.toLowerCase();

  const indices: number[] = [];
  let score = 0;
  let haystackIndex = 0;
  let previousMatchIndex = -1;

  for (let needleIndex = 0; needleIndex < lowerNeedle.length; needleIndex += 1) {
    const target = lowerNeedle[needleIndex];
    if (target === " ") continue;

    let found = -1;
    for (let i = haystackIndex; i < lowerHaystack.length; i += 1) {
      if (lowerHaystack[i] === target) {
        found = i;
        break;
      }
    }
    if (found === -1) return null;

    score += SCORE_MATCH;

    if (previousMatchIndex >= 0 && found === previousMatchIndex + 1) {
      score += SCORE_CONSECUTIVE;
    } else if (previousMatchIndex >= 0) {
      score += Math.max(MAX_LEADING_PENALTY, PENALTY_GAP * (found - previousMatchIndex - 1));
    }

    if (isWordStart(haystack, found)) score += SCORE_WORD_START;
    else if (isCamelStart(haystack, found)) score += SCORE_CAMEL_START;

    if (needleIndex === 0) {
      score += Math.max(MAX_LEADING_PENALTY, PENALTY_LEADING * found);
    }

    indices.push(found);
    previousMatchIndex = found;
    haystackIndex = found + 1;
  }

  // Prefer the tighter of two otherwise equal matches.
  score -= Math.floor(haystack.length / 8);

  return { score, indices };
}

export type FuzzyField = {
  text: string;
  /** Multiplier applied to this field's score; keywords should rank below titles. */
  weight: number;
};

/**
 * Score an item across several fields, keeping the highlight indices from the
 * best-scoring field only (highlighting a keyword the user cannot see is noise).
 */
export function fuzzyMatchFields(fields: FuzzyField[], needle: string): FuzzyMatch | null {
  let best: FuzzyMatch | null = null;
  let bestIsPrimary = false;

  fields.forEach((field, index) => {
    const match = fuzzyMatch(field.text, needle);
    if (!match) return;
    const weighted: FuzzyMatch = { score: match.score * field.weight, indices: match.indices };
    if (!best || weighted.score > best.score) {
      best = weighted;
      bestIsPrimary = index === 0;
    }
  });

  // Only the primary field's indices map onto the label we actually render.
  if (best && !bestIsPrimary) return { score: (best as FuzzyMatch).score, indices: [] };
  return best;
}

/**
 * Command-menu search, modelled directly on Omarchy's `omarchy-menu`.
 *
 * The deliberate choice here is **substring matching, not fuzzy subsequence**.
 * Omarchy's own menu (`MenuModel.js`) requires every whitespace-separated term
 * to appear as a literal substring, and leans on hand-written aliases to cover
 * the rest. It is far more predictable than subsequence matching — typing `thm`
 * finds nothing rather than three surprising rows — and predictability is what
 * makes a menu feel fast once your hands know it.
 *
 * Subsequence matching survives only as a last-resort tier, so a user who does
 * type `thm` gets a suggestion instead of an empty pane.
 */

import { fuzzyMatch } from "./fuzzy";

export type MenuEntry = {
  id: string;
  label: string;
  /** Established names a user might type. Kept deliberately sparse. */
  aliases?: string[];
  description?: string;
  /** Submenus rank slightly above leaves, as in Omarchy. */
  isGroup?: boolean;
  /** Depth in the tree, used as a tiebreak so shallow results surface first. */
  depth: number;
  /** Declaration order, the final tiebreak — keeps results stable. */
  order: number;
};

/** Lower is better, matching Omarchy's scoring direction. */
export type MatchTier = "exact" | "prefix" | "substring" | "alias" | "description" | "subsequence";

const TIER_SCORE: Record<MatchTier, number> = {
  exact: 0,
  prefix: 10,
  substring: 30,
  alias: 40,
  description: 60,
  subsequence: 90,
};

export type MenuSearchResult<T extends MenuEntry = MenuEntry> = {
  entry: T;
  tier: MatchTier;
  rank: number;
};

function terms(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter((term) => term !== "");
}

/** The text a term may match against, mirroring Omarchy's `nameText`. */
function nameText(entry: MenuEntry): string {
  const leafId = entry.id.split(".").pop() ?? entry.id;
  return [entry.label, leafId, ...(entry.aliases ?? [])].join(" ").toLowerCase();
}

function hasWholeWord(text: string, term: string): boolean {
  if (!text) return false;
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .some((word) => word === term);
}

/**
 * AND semantics: every term must match somewhere. `"real estate"` finds the
 * real-estate template; `"real zebra"` finds nothing.
 */
export function matchesQuery(entry: MenuEntry, query: string): boolean {
  const list = terms(query);
  if (list.length === 0) return true;
  const name = nameText(entry);
  return list.every((term) => name.includes(term) || hasWholeWord(entry.description ?? "", term));
}

/** Best (lowest) tier this entry achieves for the query, or null if it misses. */
export function matchTier(entry: MenuEntry, query: string): MatchTier | null {
  const list = terms(query);
  if (list.length === 0) return "exact";

  const label = entry.label.toLowerCase();
  const joined = list.join(" ");
  const leafId = (entry.id.split(".").pop() ?? entry.id).toLowerCase();
  const aliases = (entry.aliases ?? []).map((alias) => alias.toLowerCase());

  if (!matchesQuery(entry, query)) return null;

  if (label === joined) return "exact";
  if (label.startsWith(joined)) return "prefix";
  if (label.includes(joined)) return "substring";
  if (aliases.some((alias) => alias.includes(joined)) || leafId.includes(joined)) return "alias";
  if (list.every((term) => label.includes(term))) return "substring";
  if (list.every((term) => nameText(entry).includes(term))) return "alias";
  return "description";
}

/**
 * Final rank. Tier dominates; depth and declaration order only break ties, so
 * results never reshuffle unpredictably as the user types.
 */
export function rankEntry(entry: MenuEntry, tier: MatchTier): number {
  const groupBonus = entry.isGroup ? -2 : 0;
  return (TIER_SCORE[tier] + groupBonus) * 1000 + entry.depth * 25 + entry.order;
}

export function searchMenuEntries<T extends MenuEntry>(
  entries: readonly T[],
  query: string,
): MenuSearchResult<T>[] {
  const trimmed = query.trim();

  if (trimmed === "") {
    return entries.map((entry) => ({ entry, tier: "exact" as MatchTier, rank: entry.order }));
  }

  const results: MenuSearchResult<T>[] = [];
  entries.forEach((entry) => {
    const tier = matchTier(entry, trimmed);
    if (!tier) return;
    results.push({ entry, tier, rank: rankEntry(entry, tier) });
  });

  // Last resort only: if literal matching found nothing, fall back to
  // subsequence so the pane is never empty when something plausibly matches.
  if (results.length === 0) {
    entries.forEach((entry) => {
      const match = fuzzyMatch(entry.label, trimmed);
      if (!match) return;
      results.push({ entry, tier: "subsequence", rank: rankEntry(entry, "subsequence") - match.score });
    });
  }

  return results.sort((a, b) => a.rank - b.rank || a.entry.label.localeCompare(b.entry.label));
}

/**
 * Split results the way Omarchy's menu does: rows at the level you are standing
 * on, and rows found deeper in the tree, shown below a divider with their parent
 * path as a subtitle.
 *
 * This is the single best idea in the design — search widens your reach without
 * moving you out of your current context.
 */
export function partitionByDepth<T extends MenuEntry>(
  results: readonly MenuSearchResult<T>[],
  currentDepth: number,
): { here: MenuSearchResult<T>[]; deeper: MenuSearchResult<T>[] } {
  const here: MenuSearchResult<T>[] = [];
  const deeper: MenuSearchResult<T>[] = [];
  results.forEach((result) => {
    if (result.entry.depth <= currentDepth) here.push(result);
    else deeper.push(result);
  });
  return { here, deeper };
}

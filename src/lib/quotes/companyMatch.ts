/**
 * Wrong-company warning comparison (Spec 08/C).
 *
 * Compares the linked contact's company (CRM `Contact.company`) with the
 * proposal company (`snapshot.contactInfo.companyName`, fallback
 * `QuoteClient.company`) so the builder can warn staff when they differ.
 *
 * Normalization decisions (documented per spec):
 * - Trimmed, lowercased, inner whitespace collapsed: "  BBQ  Grill" = "bbq grill".
 * - Punctuation ignored: apostrophes join ("Mike's BBQ, Inc." compares as
 *   "mikes bbq"); other punctuation splits words.
 * - "&" reads as "and": "Smith & Sons LLC" MATCHES "smith and sons".
 *   An ampersand is a word joiner in company names, not punctuation to drop
 *   ("smith sons" vs "smith and sons" would otherwise false-positive).
 * - Trailing corporate suffixes stripped: LLC, Inc, Co, Corp, Ltd, PLLC
 *   ("Acme Corp" = "acme"). Only trailing tokens are stripped, so "Core Labs"
 *   keeps its "core". A name that is ONLY a suffix (e.g. "Co") keeps it.
 * - Known limit: dotted suffixes ("L.L.C.") are not collapsed to "llc".
 *
 * Either side empty (null, "", whitespace-only) means there is nothing to
 * compare, so the result is "unknown" and no warning renders.
 */

export type CompanyMatchResult = "match" | "mismatch" | "unknown";

const CORPORATE_SUFFIXES = new Set(["llc", "inc", "co", "corp", "ltd", "pllc"]);

/** Normalize a company name for comparison. Exported for tests and debugging. */
export function normalizeCompanyName(value: string | null | undefined): string {
  const text = (value ?? "").trim().toLowerCase();
  if (!text) return "";
  // "&" joins names ("Smith & Sons" = "Smith and Sons"); expand it before
  // punctuation removal so it is not dropped into "smith sons".
  const withAnd = text.replace(/&/g, " and ");
  // Apostrophes join ("Mike's" = "Mikes"); drop them before the remaining
  // punctuation is turned into word separators.
  const withoutApostrophes = withAnd.replace(/['’`]/g, "");
  // Ignore punctuation: keep letters, numbers, and whitespace.
  const wordsOnly = withoutApostrophes.replace(/[^\p{L}\p{N}\s]/gu, " ");
  const tokens = wordsOnly.split(/\s+/).filter(Boolean);
  // Strip trailing corporate suffixes (LLC, Inc, Co, Corp, Ltd, PLLC).
  let end = tokens.length;
  while (end > 0 && CORPORATE_SUFFIXES.has(tokens[end - 1])) end -= 1;
  const stripped = tokens.slice(0, end);
  // A name that IS only a suffix (e.g. "Co") keeps its normalized form
  // instead of comparing as empty.
  return (stripped.length > 0 ? stripped : tokens).join(" ");
}

/**
 * Compare the linked contact's company with the proposal company.
 * Returns "unknown" when either side is empty; otherwise "match" when the
 * normalized names are equal, "mismatch" when they differ.
 */
export function compareCompanyNames(
  contactCompany: string | null | undefined,
  proposalCompany: string | null | undefined,
): CompanyMatchResult {
  if (!contactCompany?.trim() || !proposalCompany?.trim()) return "unknown";
  return normalizeCompanyName(contactCompany) === normalizeCompanyName(proposalCompany)
    ? "match"
    : "mismatch";
}

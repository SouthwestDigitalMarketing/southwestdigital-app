export type ArContact = {
  id: string;
  name: string;
  company: string | null;
};

export type ArInvoiceRow = {
  customerName: string;
  dueDate: Date | null;
  openBalance: number;
};

const LEGAL_SUFFIXES = new Set([
  "llc",
  "inc",
  "incorporated",
  "corp",
  "corporation",
  "co",
  "company",
  "pllc",
  "pa",
  "cpa",
  "llp",
  "ltd",
  "limited",
]);

/** Lowercase, punctuation-free, legal suffixes dropped: "BnB Getaway LLC" -> "bnb getaway". */
export function normalizeCustomerName(value: string): string {
  const tokens = value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  while (tokens.length > 1 && LEGAL_SUFFIXES.has(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(" ");
}

/**
 * Names must fit: exact normalized equality, or the shorter side's tokens
 * (at least two) all appear in the longer side. "ARI Warehouse" fits inside
 * "ARI Warehouse Solutions"; "Mike Arnett" does not fit "Diana Arnett".
 */
function namesFit(left: string, right: string): boolean {
  if (!left || !right) return false;
  if (left === right) return true;
  const leftTokens = new Set(left.split(" "));
  const rightTokens = new Set(right.split(" "));
  const [shorter, longer] =
    leftTokens.size <= rightTokens.size ? [leftTokens, rightTokens] : [rightTokens, leftTokens];
  return shorter.size >= 2 && [...shorter].every((token) => longer.has(token));
}

/** Match one QuickBooks customer to a contact id, or null when nothing fits. */
export function matchArCustomerToContact(
  customerName: string,
  contacts: ArContact[],
): string | null {
  const candidates = new Set<string>();
  for (const part of customerName.split(":")) {
    const normalized = normalizeCustomerName(part);
    if (normalized) candidates.add(normalized);
  }
  for (const contact of contacts) {
    const contactNames = [normalizeCustomerName(contact.name)];
    if (contact.company) contactNames.push(normalizeCustomerName(contact.company));
    for (const candidate of candidates) {
      for (const contactName of contactNames) {
        if (contactName && namesFit(candidate, contactName)) return contact.id;
      }
    }
  }
  return null;
}

function dueKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export type PastDueEntry = {
  pastDue: number;
  oldestDue: string | null;
};

/**
 * Total past-due balance per contact id. An invoice counts when its own terms
 * say so: due date passed, balance still open. Missing due dates never count.
 */
export function buildPastDueMap(
  rows: ArInvoiceRow[],
  contacts: ArContact[],
  today: string,
): Map<string, PastDueEntry> {
  const result = new Map<string, PastDueEntry>();
  for (const row of rows) {
    if (!row.dueDate || row.openBalance <= 0) continue;
    if (dueKey(row.dueDate) >= today) continue;
    const contactId = matchArCustomerToContact(row.customerName, contacts);
    if (!contactId) continue;
    const entry = result.get(contactId) ?? { pastDue: 0, oldestDue: null };
    entry.pastDue += row.openBalance;
    const due = dueKey(row.dueDate);
    if (!entry.oldestDue || due < entry.oldestDue) entry.oldestDue = due;
    result.set(contactId, entry);
  }
  return result;
}

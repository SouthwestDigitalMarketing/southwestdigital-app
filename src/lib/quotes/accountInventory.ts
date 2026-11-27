export const ACCOUNT_KINDS = [
  "checking",
  "savings",
  "credit_card",
  "loan",
  "line_of_credit",
  "vehicle_note",
  "merchant",
  "other",
] as const;

export type AccountKind = (typeof ACCOUNT_KINDS)[number];
export type AccountStatus = "open" | "closed";
export type AccountBasis = "measured" | "estimated";
export type InventoryBand = "0-99" | "100-499" | "500-999" | "1000+";

export interface AccountEntry {
  id: string;
  kind: AccountKind;
  label: string;
  last4?: string;
  status: AccountStatus;
  monthlyTransactions: number;
  basis: AccountBasis;
  source?: string;
}

export interface BandOverride {
  band: InventoryBand | "unknown";
  reason: string;
}

export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  checking: "Checking",
  savings: "Savings",
  credit_card: "Credit card",
  loan: "Loan",
  line_of_credit: "Line of credit",
  vehicle_note: "Vehicle note",
  merchant: "Merchant / payouts",
  other: "Other",
};

function trimmedText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMonthlyTransactions(value: unknown): number {
  const count = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  return Number.isFinite(count) ? Math.trunc(Math.min(1_000_000, Math.max(0, count))) : 0;
}

/** Stored rows need a stable ID and a recognized kind; incomplete fields get safe defaults. */
export function normalizeAccountEntry(raw: unknown): AccountEntry | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const id = trimmedText(row.id);
  if (!id || !ACCOUNT_KINDS.includes(row.kind as AccountKind)) return null;

  const kind = row.kind as AccountKind;
  const last4 = trimmedText(row.last4).replace(/\D/g, "").slice(-4);
  const source = trimmedText(row.source).slice(0, 120).trim();

  return {
    id,
    kind,
    label: trimmedText(row.label) || ACCOUNT_KIND_LABELS[kind],
    ...(last4 ? { last4 } : {}),
    status: row.status === "closed" ? "closed" : "open",
    monthlyTransactions: normalizeMonthlyTransactions(row.monthlyTransactions),
    basis: row.basis === "measured" ? "measured" : "estimated",
    ...(source ? { source } : {}),
  };
}

export function normalizeAccountInventory(raw: unknown): AccountEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries = raw.flatMap((value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const row = value as Record<string, unknown>;
    const originalId = trimmedText(row.id);
    const entry = normalizeAccountEntry({ ...row, id: originalId || "account" });
    return entry ? [{ entry, originalId }] : [];
  });
  // Reserve stored IDs before allocating replacements, so a generated suffix
  // cannot take the ID of a real account later in the list.
  const reservedIds = new Set(entries.map(({ originalId }) => originalId).filter(Boolean));
  const usedIds = new Set<string>();
  const nextSuffix = new Map<string, number>();
  return entries.map(({ entry, originalId }) => {
    if (!originalId || usedIds.has(originalId)) {
      const base = originalId || "account";
      let id = base;
      let suffix = nextSuffix.get(base) ?? 2;
      while (reservedIds.has(id) || usedIds.has(id)) {
        id = `${base}-${suffix++}`;
      }
      nextSuffix.set(base, suffix);
      entry.id = id;
    }
    usedIds.add(entry.id);
    return entry;
  });
}

export function bandForMonthlyTotal(total: number): InventoryBand {
  if (total < 100) return "0-99";
  if (total < 500) return "100-499";
  if (total < 1000) return "500-999";
  return "1000+";
}

export interface AccountInventorySummary {
  openAccounts: AccountEntry[];
  closedAccounts: AccountEntry[];
  openMonthlyTotal: number;
  closedMonthlyTotal: number;
  hasInventory: boolean;
  basis: AccountBasis | null;
  hasEstimated: boolean;
  closedOnly: boolean;
  derivedBand: InventoryBand | null;
  derivedCounts: {
    bankAccountsCount: number;
    creditCardsCount: number;
    loansCount: number;
    linesOfCreditCount: number;
    vehicleNotesCount: number;
    merchantAccountsCount: number;
  };
  warnings: string[];
}

export function summarizeAccountInventory(accounts: AccountEntry[]): AccountInventorySummary {
  const openAccounts = accounts.filter((account) => account.status === "open");
  const closedAccounts = accounts.filter((account) => account.status === "closed");
  // Bound each contribution even for callers that bypass row normalization.
  // At this cap, even the maximum JavaScript array length has a safe total.
  const openMonthlyTotal = openAccounts.reduce((total, account) => total + normalizeMonthlyTransactions(account.monthlyTransactions), 0);
  const closedMonthlyTotal = closedAccounts.reduce((total, account) => total + normalizeMonthlyTransactions(account.monthlyTransactions), 0);
  const hasInventory = openAccounts.length > 0;
  const hasEstimated = openAccounts.some((account) => account.basis === "estimated");
  const closedOnly = !hasInventory && closedAccounts.length > 0;
  const derivedCounts: AccountInventorySummary["derivedCounts"] = {
    bankAccountsCount: 0,
    creditCardsCount: 0,
    loansCount: 0,
    linesOfCreditCount: 0,
    vehicleNotesCount: 0,
    merchantAccountsCount: 0,
  };

  for (const account of openAccounts) {
    switch (account.kind) {
      case "checking":
      case "savings": derivedCounts.bankAccountsCount++; break;
      case "credit_card": derivedCounts.creditCardsCount++; break;
      case "loan": derivedCounts.loansCount++; break;
      case "line_of_credit": derivedCounts.linesOfCreditCount++; break;
      case "vehicle_note": derivedCounts.vehicleNotesCount++; break;
      case "merchant": derivedCounts.merchantAccountsCount++; break;
      case "other": break;
    }
  }

  const warnings: string[] = [];
  if (hasEstimated) {
    warnings.push("Some open accounts have estimated transaction counts. Confirm the counts with the client.");
  }
  if (closedOnly) {
    warnings.push(`Only closed accounts are listed (${closedMonthlyTotal.toLocaleString("en-US")} monthly transactions). Add an open account to size the proposal.`);
  }

  return {
    openAccounts,
    closedAccounts,
    openMonthlyTotal,
    closedMonthlyTotal,
    hasInventory,
    basis: hasInventory ? (hasEstimated ? "estimated" : "measured") : null,
    hasEstimated,
    closedOnly,
    derivedBand: hasInventory ? bandForMonthlyTotal(openMonthlyTotal) : null,
    derivedCounts,
    warnings,
  };
}

export function validateBandOverride(
  o: Partial<BandOverride> | null | undefined,
): { ok: true } | { ok: false; error: string } {
  if (!o || !["0-99", "100-499", "500-999", "1000+", "unknown"].includes(o.band ?? "")) {
    return { ok: false, error: "Choose a valid transaction band." };
  }
  if (typeof o.reason !== "string" || o.reason.trim().length < 3) {
    return { ok: false, error: "Give a reason for the override (at least 3 characters)." };
  }
  if (/[\r\n\u2028\u2029]/.test(o.reason)) {
    return { ok: false, error: "Keep the override reason on one line." };
  }
  return { ok: true };
}

export function resolveTransactionBand(input: {
  accounts?: unknown;
  transactionBand?: string;
  bandOverride?: Partial<BandOverride> | null;
}): { band: string; source: "inventory" | "override" | "manual" } {
  const summary = summarizeAccountInventory(normalizeAccountInventory(input.accounts));
  if (!summary.hasInventory) {
    return { band: input.transactionBand ?? "", source: "manual" };
  }
  if (validateBandOverride(input.bandOverride).ok && input.bandOverride?.band) {
    return { band: input.bandOverride.band, source: "override" };
  }
  return { band: summary.derivedBand!, source: "inventory" };
}

export interface PublicAccountInventory {
  accounts: Array<{
    kind: AccountKind;
    kindLabel: string;
    label: string;
    last4?: string;
    monthlyTransactions: number;
    basis: AccountBasis;
  }>;
  monthlyTotal: number;
  basis: AccountBasis;
  hasEstimated: boolean;
}

export function toPublicAccountInventory(raw: unknown): PublicAccountInventory | null {
  const summary = summarizeAccountInventory(normalizeAccountInventory(raw));
  if (!summary.hasInventory) return null;
  return {
    accounts: summary.openAccounts.map((account) => ({
      kind: account.kind,
      kindLabel: ACCOUNT_KIND_LABELS[account.kind],
      label: account.label,
      ...(account.last4 ? { last4: account.last4 } : {}),
      monthlyTransactions: account.monthlyTransactions,
      basis: account.basis,
    })),
    monthlyTotal: summary.openMonthlyTotal,
    basis: summary.basis!,
    hasEstimated: summary.hasEstimated,
  };
}

export const ESTIMATE_NOTICE_TEXT = "Some counts are estimates. We confirm them in the first 90 days (see Volume-based pricing).";

export function volumeClauseText(input: {
  monthlyTotal?: number | null;
  basis?: AccountBasis | null;
  brandName: string;
}): string {
  const volume = typeof input.monthlyTotal === "number" && Number.isFinite(input.monthlyTotal)
    ? `about ${input.monthlyTotal.toLocaleString("en-US")} transactions per month across the accounts listed (${input.basis === "measured" ? "measured" : "partly estimated"})`
    : "the transaction volume across the accounts listed";
  return `Volume-based pricing. The monthly fee is based on ${volume}. About 90 days after work begins, and once a year after that, ${input.brandName} will recheck the average monthly volume. If it has moved into a different pricing band, the monthly fee moves to that band's price, up or down, with 30 days' written notice. Adding or closing accounts counts toward the recheck.`;
}

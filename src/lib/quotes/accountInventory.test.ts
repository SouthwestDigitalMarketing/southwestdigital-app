import { describe, expect, it } from "vitest";
import {
  ACCOUNT_KINDS,
  ACCOUNT_KIND_LABELS,
  ESTIMATE_NOTICE_TEXT,
  bandForMonthlyTotal,
  normalizeAccountEntry,
  normalizeAccountInventory,
  resolveTransactionBand,
  summarizeAccountInventory,
  toPublicAccountInventory,
  validateBandOverride,
  volumeClauseText,
  type AccountEntry,
  type BandOverride,
  type InventoryBand,
} from "./accountInventory";

function account(overrides: Partial<AccountEntry> = {}): AccountEntry {
  return {
    id: "checking-1",
    kind: "checking",
    label: "Chase checking",
    last4: "1234",
    status: "open",
    monthlyTransactions: 75,
    basis: "measured",
    source: "QBO feed Jun-Aug 2026",
    ...overrides,
  };
}

const zeroCounts = {
  bankAccountsCount: 0,
  creditCardsCount: 0,
  loansCount: 0,
  linesOfCreditCount: 0,
  vehicleNotesCount: 0,
  merchantAccountsCount: 0,
};

describe("account kinds", () => {
  it("exports the agreed kinds and labels", () => {
    expect(ACCOUNT_KINDS).toEqual([
      "checking", "savings", "credit_card", "loan", "line_of_credit", "vehicle_note", "merchant", "other",
    ]);
    expect(ACCOUNT_KIND_LABELS).toEqual({
      checking: "Checking",
      savings: "Savings",
      credit_card: "Credit card",
      loan: "Loan",
      line_of_credit: "Line of credit",
      vehicle_note: "Vehicle note",
      merchant: "Merchant / payouts",
      other: "Other",
    });
  });
});

describe("bandForMonthlyTotal", () => {
  it.each<[number, InventoryBand]>([
    [0, "0-99"],
    [99, "0-99"],
    [100, "100-499"],
    [499, "100-499"],
    [500, "500-999"],
    [999, "500-999"],
    [1000, "1000+"],
    [12500, "1000+"],
  ])("maps %s to %s", (total, expected) => {
    expect(bandForMonthlyTotal(total)).toBe(expected);
  });
});

describe("normalizeAccountEntry", () => {
  it("preserves a complete stored account", () => {
    expect(normalizeAccountEntry(account())).toEqual(account());
  });

  it.each([null, undefined, false, 5, "checking", [], {}])("drops unusable input %j", (raw) => {
    expect(normalizeAccountEntry(raw)).toBeNull();
  });

  it.each(["bank", "CHECKING", "", null, undefined, 1, {}, []])("drops invalid kind %j", (kind) => {
    expect(normalizeAccountEntry({ ...account(), kind })).toBeNull();
  });

  it.each(["", "  ", null, undefined, 10])("requires a stable string ID: %j", (id) => {
    expect(normalizeAccountEntry({ ...account(), id })).toBeNull();
  });

  it("trims text and supplies conservative defaults for incomplete fields", () => {
    expect(normalizeAccountEntry({ id: "  row-1  ", kind: "savings", label: "  " })).toEqual({
      id: "row-1",
      kind: "savings",
      label: "Savings",
      status: "open",
      monthlyTransactions: 0,
      basis: "estimated",
    });
    expect(normalizeAccountEntry({ ...account(), label: "  Operating checking  " })?.label)
      .toBe("Operating checking");
    expect(normalizeAccountEntry({ ...account(), status: "bad", basis: "bad" }))
      .toMatchObject({ status: "open", basis: "estimated" });
  });

  it.each([
    [-12, 0], [-0.9, 0], [0, 0], [12.9, 12], ["42.8", 42], ["-1.2", 0],
    [Number.NaN, 0], [Infinity, 0], [-Infinity, 0], ["no count", 0],
    [null, 0], [undefined, 0], [true, 0], [{}, 0],
    [1_000_000, 1_000_000], [1_000_001, 1_000_000], [1e308, 1_000_000],
    [Number.MAX_SAFE_INTEGER + 1, 1_000_000], ["1e9", 1_000_000],
  ])("normalizes transaction count %j to %s", (monthlyTransactions, expected) => {
    expect(normalizeAccountEntry({ ...account(), monthlyTransactions })?.monthlyTransactions).toBe(expected);
  });

  it.each([
    ["12-34", "1234"],
    ["1234 5678 9012 3456", "3456"],
    ["•• 007", "007"],
    ["1", "1"],
    ["no digits", undefined],
    [null, undefined],
  ])("keeps only the final four digits of %j", (last4, expected) => {
    expect(normalizeAccountEntry({ ...account(), last4 })?.last4).toBe(expected);
  });

  it("trims and limits source notes to 120 characters", () => {
    expect(normalizeAccountEntry({ ...account(), source: "  Client said  " })?.source).toBe("Client said");
    expect(normalizeAccountEntry({ ...account(), source: `  ${"x".repeat(150)}  ` })?.source)
      .toBe("x".repeat(120));
    expect(normalizeAccountEntry({ ...account(), source: "  " })).not.toHaveProperty("source");
  });

  it("does not mutate stored data or retain unknown fields", () => {
    const raw = { ...account(), last4: "12345678", internalMemo: "private" };
    const before = { ...raw };
    const result = normalizeAccountEntry(raw);
    expect(raw).toEqual(before);
    expect(result).not.toHaveProperty("internalMemo");
    expect(result?.last4).toBe("5678");
  });
});

describe("normalizeAccountInventory", () => {
  it("keeps colliding real accounts with deterministic unique IDs and counts each once", () => {
    const raw = [
      account({ id: "same", monthlyTransactions: 60 }),
      account({ id: " same ", label: "Other checking", monthlyTransactions: 70 }),
      account({ id: "same-2", monthlyTransactions: 80 }),
      account({ id: "", monthlyTransactions: 90 }),
      account({ id: "  ", status: "closed", monthlyTransactions: 100 }),
      account({ id: "account", monthlyTransactions: 110 }),
      { ...account(), id: undefined, monthlyTransactions: 120 },
    ];
    const before = structuredClone(raw);
    const normalized = normalizeAccountInventory(raw);
    expect(normalized.map((row) => row.id))
      .toEqual(["same", "same-3", "same-2", "account-2", "account-3", "account", "account-4"]);
    expect(normalized).toHaveLength(raw.length);
    expect(normalizeAccountInventory(raw)).toEqual(normalized);
    expect(normalizeAccountInventory(normalized)).toEqual(normalized);
    expect(raw).toEqual(before);
    expect(summarizeAccountInventory(normalized)).toMatchObject({
      openMonthlyTotal: 530, closedMonthlyTotal: 100, derivedBand: "500-999",
      derivedCounts: { ...zeroCounts, bankAccountsCount: 6 },
    });
    expect(toPublicAccountInventory(raw)).toMatchObject({ monthlyTotal: 530 });
  });

  it.each([undefined, null, {}, "[]", 10])("returns an empty list for non-array input %j", (raw) => {
    expect(normalizeAccountInventory(raw)).toEqual([]);
  });

  it("drops unusable rows, preserving the order and status of usable rows", () => {
    const closed = account({ id: "closed-1", status: "closed" });
    expect(normalizeAccountInventory([null, account(), { ...account(), kind: "bad" }, closed]))
      .toEqual([account(), closed]);
  });
});

describe("summarizeAccountInventory", () => {
  it("keeps totals safe even when callers supply unnormalized large counts", () => {
    expect(summarizeAccountInventory([
      account({ monthlyTransactions: 1e308 }),
      account({ id: "second", monthlyTransactions: Number.MAX_SAFE_INTEGER + 1 }),
      account({ id: "closed", status: "closed", monthlyTransactions: 1e308 }),
    ])).toMatchObject({ openMonthlyTotal: 2_000_000, closedMonthlyTotal: 1_000_000 });
  });

  it("counts only open accounts, with checking and savings combined", () => {
    const open = ACCOUNT_KINDS.map((kind, index) => account({ id: `open-${kind}`, kind, monthlyTransactions: index + 1 }));
    const closed = ACCOUNT_KINDS.map((kind) => account({ id: `closed-${kind}`, kind, status: "closed", monthlyTransactions: 500 }));
    const summary = summarizeAccountInventory([...open, ...closed]);
    expect(summary.openAccounts).toEqual(open);
    expect(summary.closedAccounts).toEqual(closed);
    expect(summary.openMonthlyTotal).toBe(36);
    expect(summary.closedMonthlyTotal).toBe(4000);
    expect(summary.derivedBand).toBe("0-99");
    expect(summary.derivedCounts).toEqual({
      bankAccountsCount: 2,
      creditCardsCount: 1,
      loansCount: 1,
      linesOfCreditCount: 1,
      vehicleNotesCount: 1,
      merchantAccountsCount: 1,
    });
    expect(summary.hasInventory).toBe(true);
    expect(summary.closedOnly).toBe(false);
  });

  it("includes merchant and other transactions in volume without counting other as a merchant", () => {
    expect(summarizeAccountInventory([
      account({ kind: "merchant", monthlyTransactions: 200 }),
      account({ id: "other-1", kind: "other", monthlyTransactions: 300 }),
    ])).toMatchObject({
      openMonthlyTotal: 500,
      derivedBand: "500-999",
      derivedCounts: { ...zeroCounts, merchantAccountsCount: 1 },
    });
  });

  it("is measured only when all open accounts are measured", () => {
    const summary = summarizeAccountInventory([
      account(),
      account({ id: "open-2" }),
      account({ id: "closed-1", status: "closed", basis: "estimated" }),
    ]);
    expect(summary.basis).toBe("measured");
    expect(summary.hasEstimated).toBe(false);
    expect(summary.warnings).toEqual([]);
  });

  it("is estimated and warns when even one open account is estimated", () => {
    const summary = summarizeAccountInventory([
      account(), account({ id: "open-2", basis: "estimated" }),
    ]);
    expect(summary.basis).toBe("estimated");
    expect(summary.hasEstimated).toBe(true);
    expect(summary.warnings).toHaveLength(1);
    expect(summary.warnings[0]).toMatch(/estimated/i);
  });

  it("flags closed-only inventory and warns with its excluded total", () => {
    const summary = summarizeAccountInventory([
      account({ status: "closed", monthlyTransactions: 1234, basis: "estimated" }),
    ]);
    expect(summary).toMatchObject({
      hasInventory: false,
      closedOnly: true,
      basis: null,
      hasEstimated: false,
      derivedBand: null,
      openMonthlyTotal: 0,
      closedMonthlyTotal: 1234,
      derivedCounts: zeroCounts,
    });
    expect(summary.warnings).toHaveLength(1);
    expect(summary.warnings[0]).toMatch(/closed accounts.*1,234/i);
  });

  it("returns no basis, band, counts, or warnings for an empty inventory", () => {
    expect(summarizeAccountInventory([])).toEqual({
      openAccounts: [],
      closedAccounts: [],
      openMonthlyTotal: 0,
      closedMonthlyTotal: 0,
      hasInventory: false,
      basis: null,
      hasEstimated: false,
      closedOnly: false,
      derivedBand: null,
      derivedCounts: zeroCounts,
      warnings: [],
    });
  });

  it("treats an open account with zero transactions as inventory", () => {
    expect(summarizeAccountInventory([account({ monthlyTransactions: 0 })])).toMatchObject({
      hasInventory: true, basis: "measured", derivedBand: "0-99", openMonthlyTotal: 0,
    });
  });

  it("does not mutate the supplied accounts", () => {
    const rows = [account({ status: "closed" }), account({ id: "open-2" })];
    const before = rows.map((row) => ({ ...row }));
    summarizeAccountInventory(rows);
    expect(rows).toEqual(before);
  });
});

describe("validateBandOverride", () => {
  it.each<BandOverride["band"]>(["0-99", "100-499", "500-999", "1000+", "unknown"])
    ("accepts %s with a one-line reason", (band) => {
      expect(validateBandOverride({ band, reason: "  Client expects seasonal volume  " })).toEqual({ ok: true });
    });

  it.each([undefined, null, {}, { band: "1000+" as const }, { band: "1000+" as const, reason: "  ab  " }])
    ("rejects missing or short reasons: %j", (override) => {
      expect(validateBandOverride(override)).toMatchObject({ ok: false, error: expect.any(String) });
    });

  it("rejects unrecognized or missing bands even when the reason is valid", () => {
    expect(validateBandOverride({ reason: "Seasonal volume" }).ok).toBe(false);
    expect(validateBandOverride({ band: "bad" as InventoryBand, reason: "Seasonal volume" }).ok).toBe(false);
  });

  it.each(["Seasonal\nvolume", "Seasonal\rvolume", "Seasonal\u2028volume", "Seasonal\u2029volume"])
    ("rejects multiline reason %j", (reason) => {
      expect(validateBandOverride({ band: "1000+", reason })).toMatchObject({ ok: false });
    });

  it("accepts a reason exactly three characters long after trimming", () => {
    expect(validateBandOverride({ band: "unknown", reason: "  TBD  " })).toEqual({ ok: true });
  });
});

describe("resolveTransactionBand", () => {
  it.each([undefined, "", "unknown", "0-99", "100-499", "legacy-value"])
    ("preserves the legacy manual value %j when no inventory exists", (transactionBand) => {
      expect(resolveTransactionBand({ transactionBand })).toEqual({ band: transactionBand ?? "", source: "manual" });
    });

  it.each([[], null, "[]", [account({ status: "closed" })], [{ ...account(), kind: "bad" }]])
    ("ignores overrides without an open account: %j", (accounts) => {
      expect(resolveTransactionBand({
        accounts, transactionBand: "100-499", bandOverride: { band: "1000+", reason: "Seasonal volume" },
      })).toEqual({ band: "100-499", source: "manual" });
    });

  it("derives the band from open inventory rather than the legacy manual band", () => {
    expect(resolveTransactionBand({
      accounts: [account({ monthlyTransactions: 600 }), account({ status: "closed", monthlyTransactions: 5000 })],
      transactionBand: "1000+",
    })).toEqual({ band: "500-999", source: "inventory" });
  });

  it("uses a valid override, including unknown", () => {
    expect(resolveTransactionBand({ accounts: [account()], bandOverride: { band: "unknown", reason: "Confirm later" } }))
      .toEqual({ band: "unknown", source: "override" });
    expect(resolveTransactionBand({ accounts: [account()], bandOverride: { band: "1000+", reason: "Peak season" } }))
      .toEqual({ band: "1000+", source: "override" });
  });

  it.each<Partial<BandOverride>>([
    { band: "1000+" },
    { band: "1000+", reason: " " },
    { band: "1000+", reason: "Bad\nreason" },
    { band: "bad" as InventoryBand, reason: "Valid reason" },
  ])("ignores invalid override %j", (bandOverride) => {
    expect(resolveTransactionBand({ accounts: [account()], bandOverride }))
      .toEqual({ band: "0-99", source: "inventory" });
  });
});

describe("toPublicAccountInventory", () => {
  it.each([1e308, Number.MAX_SAFE_INTEGER + 1, "1e9"])("publishes finite safe totals for oversized counts %s", (monthlyTransactions) => {
    const result = toPublicAccountInventory([
      { ...account(), monthlyTransactions },
      { ...account({ id: "second" }), monthlyTransactions },
    ])!;
    expect(result.accounts.map((row) => row.monthlyTransactions)).toEqual([1_000_000, 1_000_000]);
    expect(result.monthlyTotal).toBe(2_000_000);
    expect(Number.isSafeInteger(result.monthlyTotal)).toBe(true);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("publishes only whitelisted open account fields with sanitized last4", () => {
    const result = toPublicAccountInventory([
      { ...account(), last4: "12345678", internalMemo: "private" },
      account({ id: "closed-1", label: "Closed checking", status: "closed", monthlyTransactions: 2000 }),
      account({ id: "merchant-1", kind: "merchant", label: "Stripe", last4: undefined, monthlyTransactions: 25, basis: "estimated" }),
    ]);
    expect(result).toEqual({
      accounts: [
        { kind: "checking", kindLabel: "Checking", label: "Chase checking", last4: "5678", monthlyTransactions: 75, basis: "measured" },
        { kind: "merchant", kindLabel: "Merchant / payouts", label: "Stripe", monthlyTransactions: 25, basis: "estimated" },
      ],
      monthlyTotal: 100,
      basis: "estimated",
      hasEstimated: true,
    });
    for (const row of result!.accounts) {
      for (const field of ["id", "source", "status", "internalMemo"]) {
        expect(row).not.toHaveProperty(field);
      }
    }
  });

  it.each([null, undefined, {}, [], [account({ status: "closed" })], [{ ...account(), kind: "bad" }]])
    ("returns null without usable open inventory: %j", (raw) => {
      expect(toPublicAccountInventory(raw)).toBeNull();
    });

  it("ignores estimates on closed accounts when reporting the public basis", () => {
    expect(toPublicAccountInventory([
      account({ monthlyTransactions: 0 }), account({ id: "closed-1", status: "closed", basis: "estimated" }),
    ])).toMatchObject({ monthlyTotal: 0, basis: "measured", hasEstimated: false });
  });

  it("exports the exact estimate notice", () => {
    expect(ESTIMATE_NOTICE_TEXT).toBe("Some counts are estimates. We confirm them in the first 90 days (see Volume-based pricing).");
  });
});

describe("volumeClauseText", () => {
  const rest = "About 90 days after work begins, and once a year after that, Bookkeeping Conroe will recheck the average monthly volume. If it has moved into a different pricing band, the monthly fee moves to that band's price, up or down, with 30 days' written notice. Adding or closing accounts counts toward the recheck.";

  it("uses the exact measured wording and thousands separators", () => {
    expect(volumeClauseText({ monthlyTotal: 12345, basis: "measured", brandName: "Bookkeeping Conroe" }))
      .toBe(`Volume-based pricing. The monthly fee is based on about 12,345 transactions per month across the accounts listed (measured). ${rest}`);
  });

  it.each(["estimated", null, undefined] as const)("uses partly estimated for basis %j", (basis) => {
    expect(volumeClauseText({ monthlyTotal: 500, basis, brandName: "Bookkeeping Conroe" }))
      .toBe(`Volume-based pricing. The monthly fee is based on about 500 transactions per month across the accounts listed (partly estimated). ${rest}`);
  });

  it.each([null, undefined, Number.NaN, Infinity, -Infinity])("uses the exact wording without a finite total: %j", (monthlyTotal) => {
    expect(volumeClauseText({ monthlyTotal, basis: "measured", brandName: "Bookkeeping Conroe" }))
      .toBe(`Volume-based pricing. The monthly fee is based on the transaction volume across the accounts listed. ${rest}`);
  });

  it("keeps zero as a known total and inserts the supplied brand name", () => {
    expect(volumeClauseText({ monthlyTotal: 0, basis: "measured", brandName: "Contigo Accounting" }))
      .toBe(`Volume-based pricing. The monthly fee is based on about 0 transactions per month across the accounts listed (measured). ${rest.replace("Bookkeeping Conroe", "Contigo Accounting")}`);
  });
});

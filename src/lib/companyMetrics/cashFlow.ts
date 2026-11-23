export type CashFlowInput = {
  month: string;
  incomeUsd: number;
  expensesUsd: number;
  ownerDrawUsd: number;
  taxSetAsideUsd: number;
};

/** Amounts are dollars from Lochside's own QBO, never estimated. */
export function freeCashFlow(input: CashFlowInput): number {
  const amounts = [input.incomeUsd, input.expensesUsd, input.ownerDrawUsd, input.taxSetAsideUsd];
  if (amounts.some((value) => !Number.isFinite(value) || value < 0)) throw new Error("Invalid cash flow amount");
  return Math.round((amounts[0] - amounts[1] - amounts[2] - amounts[3]) * 100) / 100;
}

export function monthEnd(month: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Invalid month");
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
}

export function lastClosedCandidate(now: Date): string {
  const local = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit" }).formatToParts(now);
  const year = Number(local.find((part) => part.type === "year")?.value);
  const month = Number(local.find((part) => part.type === "month")?.value);
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
}

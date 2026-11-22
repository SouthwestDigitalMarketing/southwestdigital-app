import { prisma } from "@/lib/prisma";
import { freeCashFlow, lastClosedCandidate, monthEnd } from "./cashFlow";

type Payload = { month: string; incomeUsd: number; expensesUsd: number; ownerDrawUsd: number; taxSetAsideUsd: number; sourceAccounts: { ownerDraw: string; taxSetAside: string }; closedAt: string };

export function parseCashFlowPayload(value: unknown, now = new Date()): Payload | string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Expected an object";
  const row = value as Record<string, unknown>;
  if (typeof row.month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month) || row.month > lastClosedCandidate(now)) return "Month must be a past YYYY-MM";
  if (!row.sourceAccounts || typeof row.sourceAccounts !== "object") return "Source accounts required";
  const source = row.sourceAccounts as Record<string, unknown>;
  if (typeof source.ownerDraw !== "string" || !source.ownerDraw.trim() || typeof source.taxSetAside !== "string" || !source.taxSetAside.trim()) return "Both named source accounts required";
  if (typeof row.closedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.closedAt) || Number.isNaN(Date.parse(row.closedAt)) || row.closedAt < monthEnd(row.month)) return "Valid close date required";
  const amounts = [row.incomeUsd, row.expensesUsd, row.ownerDrawUsd, row.taxSetAsideUsd];
  if (amounts.some((amount) => typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || Math.round(amount * 100) !== amount * 100)) return "Amounts must be nonnegative dollars and cents";
  const input: Payload = {
    month: row.month, incomeUsd: row.incomeUsd as number, expensesUsd: row.expensesUsd as number,
    ownerDrawUsd: row.ownerDrawUsd as number, taxSetAsideUsd: row.taxSetAsideUsd as number,
    sourceAccounts: { ownerDraw: source.ownerDraw, taxSetAside: source.taxSetAside } as Payload["sourceAccounts"],
    closedAt: row.closedAt,
  };
  freeCashFlow(input);
  return input;
}

export async function upsertCashFlow(input: Payload) {
  const row = await prisma.companyCashFlowMonth.upsert({
    where: { month: input.month },
    create: { ...input, closedAt: new Date(`${input.closedAt}T12:00:00Z`) },
    update: { incomeUsd: input.incomeUsd, expensesUsd: input.expensesUsd, ownerDrawUsd: input.ownerDrawUsd, taxSetAsideUsd: input.taxSetAsideUsd, sourceAccounts: input.sourceAccounts, closedAt: new Date(`${input.closedAt}T12:00:00Z`), syncedAt: new Date() },
  });
  return { month: row.month, asOf: monthEnd(row.month), freeCashFlowUsd: freeCashFlow(input) };
}

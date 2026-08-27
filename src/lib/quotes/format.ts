export function formatUsd(n: number | string | { toNumber(): number }) {
  const val = typeof n === "object" && n !== null && "toNumber" in n ? n.toNumber() : Number(n);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);
}

export const SCENARIO_LABELS: Record<string, string> = {
  MONTHLY_BOOKKEEPING: "Monthly Bookkeeping",
  HISTORICAL_CLEANUP: "Historical Cleanup",
  HOURLY_WORK: "Hourly Work",
};

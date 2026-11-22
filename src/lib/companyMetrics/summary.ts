import { freeCashFlow, lastClosedCandidate, monthEnd, type CashFlowInput } from "./cashFlow";

export type BrandMetrics = {
  slug: string;
  name: string;
  website: string | null;
  mrrUsd: number;
  clients: number;
  newLeads: number;
  offersSent: number;
  offersAwaiting: number;
  responseSeconds: number[];
};

export type MetricsView = Omit<BrandMetrics, "responseSeconds"> & { medianResponseSeconds: number | null };

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function summarizeCompanyMetrics(brands: BrandMetrics[], cash: CashFlowInput | null, now = new Date()) {
  const views: MetricsView[] = brands.map(({ responseSeconds, ...brand }) => ({ ...brand, medianResponseSeconds: median(responseSeconds) }));
  const total: MetricsView = {
    slug: "total", name: "Lochside LLC", website: null,
    mrrUsd: views.reduce((n, brand) => n + brand.mrrUsd, 0),
    clients: views.reduce((n, brand) => n + brand.clients, 0),
    newLeads: views.reduce((n, brand) => n + brand.newLeads, 0),
    offersSent: views.reduce((n, brand) => n + brand.offersSent, 0),
    offersAwaiting: views.reduce((n, brand) => n + brand.offersAwaiting, 0),
    medianResponseSeconds: median(brands.flatMap((brand) => brand.responseSeconds)),
  };
  return {
    total, brands: views,
    cashFlow: cash ? {
      month: cash.month,
      asOf: monthEnd(cash.month),
      valueUsd: freeCashFlow(cash),
      stale: cash.month < lastClosedCandidate(now),
    } : null,
    expectedMonth: lastClosedCandidate(now),
  };
}

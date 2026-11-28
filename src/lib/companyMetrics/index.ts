import "server-only";

import { prisma } from "@/lib/prisma";
import { getRecordMrr } from "@/lib/operations/serviceRecordsMrr";
import { createBrandDataContext, withBrandDataTransaction } from "@/lib/tenancy/context";
import { BRAND_WEBSITES } from "@/lib/brands/tools";
import { summarizeCompanyMetrics, type BrandMetrics } from "./summary";
import { quoteIsTestProposal } from "@/lib/quotes/testProposal";

export { summarizeCompanyMetrics } from "./summary";
export type { BrandMetrics, MetricsView } from "./summary";

export const COMPANY_BRANDS = ["bookkeeping-conroe", "real-estate-bookkeeper"] as const;

/**
 * Shared read model for Dashboard and Showrunner Studio. The caller must pass
 * an authenticated platform operator; never expose cross-brand rows to a
 * single-brand member. `from` and `to` are firm-local midnight instants.
 */
export async function getCompanyMetrics(input: {
  actorUserId: string;
  isPlatformOperator: boolean;
  from: Date;
  to: Date;
  now?: Date;
}) {
  if (!input.isPlatformOperator) throw new Error("Company metrics require a platform operator");
  const brands = await prisma.brand.findMany({
    where: { slug: { in: [...COMPANY_BRANDS] }, status: "ACTIVE" },
    select: { id: true, slug: true, name: true, toolLinks: { where: { key: "website" }, select: { url: true } } },
  });
  const rows = await Promise.all(COMPANY_BRANDS.map(async (slug): Promise<BrandMetrics> => {
    const brand = brands.find((item) => item.slug === slug);
    if (!brand) return { slug, name: slug === "bookkeeping-conroe" ? "Bookkeeping Conroe" : "The Real Estate Bookkeeper", website: BRAND_WEBSITES[slug], mrrUsd: 0, clients: 0, newLeads: 0, offersSent: 0, offersAwaiting: 0, responseSeconds: [] };
    const context = createBrandDataContext({ brandId: brand.id, actorUserId: input.actorUserId });
    const [mrr, activity] = await Promise.all([
      getRecordMrr(brand.id, input.now),
      withBrandDataTransaction(context, async (tx) => {
        const testFlags = { snapshotJson: true, engagement: { select: { isTestProposal: true } } } as const;
        const [newLeads, sentQuotes, awaitingQuotes, replies] = await Promise.all([
          tx.meetingLead.count({ where: { brandId: brand.id, isActive: true, kind: "LEAD", createdAt: { gte: input.from, lt: input.to } } }),
          // Archived offers (tests, superseded versions) do not count as sent (Tom, 2026-11-24).
          tx.quote.findMany({ where: { brandId: brand.id, sentAt: { gte: input.from, lt: input.to }, status: { not: "archived" } }, select: testFlags }),
          tx.quote.findMany({ where: { brandId: brand.id, status: "sent" }, select: testFlags }),
          tx.scorecardEvent.findMany({ where: { brandId: brand.id, startedAt: { gte: input.from, lt: input.to }, respondedAt: { not: null }, businessSeconds: { not: null }, channel: { in: ["text", "call", "email"] } }, select: { businessSeconds: true } }),
        ]);
        // Test proposals are staff-only fixtures, not sales activity.
        const sent = sentQuotes.filter((quote) => !quoteIsTestProposal(quote)).length;
        const awaiting = awaitingQuotes.filter((quote) => !quoteIsTestProposal(quote)).length;
        return { newLeads, sent, awaiting, responseSeconds: replies.flatMap((row) => row.businessSeconds === null ? [] : [row.businessSeconds]) };
      }),
    ]);
    return {
      slug, name: brand.name, website: brand.toolLinks[0]?.url || BRAND_WEBSITES[slug] || null,
      mrrUsd: mrr.clients.reduce((sum, client) => sum + client.mrr, 0), clients: mrr.clients.length,
      newLeads: activity.newLeads, offersSent: activity.sent, offersAwaiting: activity.awaiting,
      responseSeconds: activity.responseSeconds,
    };
  }));
  let cash = null;
  try {
    cash = await prisma.companyCashFlowMonth.findFirst({ orderBy: { month: "desc" } });
  } catch (error) {
    // Vercel previews share production's database and cannot apply migrations.
    // The dashboard remains usable until this additive table is deployed.
    if (!(error instanceof Error) || !error.message.includes("CompanyCashFlowMonth")) throw error;
  }
  return summarizeCompanyMetrics(rows, cash && {
    month: cash.month, incomeUsd: Number(cash.incomeUsd), expensesUsd: Number(cash.expensesUsd),
    ownerDrawUsd: Number(cash.ownerDrawUsd), taxSetAsideUsd: Number(cash.taxSetAsideUsd),
  }, input.now);
}

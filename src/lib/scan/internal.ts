import type { PrismaClient } from "@prisma/client";
import { COMPANY_BRANDS } from "@/lib/companyMetrics";
import { getTrafficTrend, hasGA4Credentials } from "@/lib/analytics/ga4";
import type { ScanChange } from "./scan";

export type InternalScanResult = {
  changes: ScanChange[];
  ga4: { bkc: number; treb: number; combined: number } | null;
  /** No GA key on the server: the GA4 row needs a human, not a retry. */
  ga4NeedsLogin: boolean;
};

function day(offset: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

/** SWapp-side changes since the last finished run: proposals viewed, accepted,
 * paid, plus a GA4 traffic snapshot. Never throws: GA4 may be unavailable. */
export async function computeInternalChanges(db: PrismaClient, since: Date | null): Promise<InternalScanResult> {
  const changes: ScanChange[] = [];
  const floor = since ?? new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [views, accepted, signed, paid] = await Promise.all([
    db.proposalViewEvent.findMany({
      where: { occurredAt: { gte: floor } },
      orderBy: { occurredAt: "desc" },
      take: 10,
      include: { quote: { select: { client: { select: { name: true } }, brandId: true } } },
    }),
    db.quote.findMany({
      where: { status: "accepted", updatedAt: { gte: floor } },
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: { client: { select: { name: true } } },
    }),
    db.engagement.findMany({
      where: { status: "SIGNED", updatedAt: { gte: floor } },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    db.engagement.findMany({
      where: { status: "DEPOSIT_PAID", updatedAt: { gte: floor } },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
  ]);

  if (views.length > 0) {
    const names = [...new Set(views.map((view) => view.quote.client.name))].slice(0, 3).join(", ");
    changes.push({ kind: "swapp", text: `${views.length} proposal view${views.length === 1 ? "" : "s"} (${names})` });
  }
  for (const quote of accepted) changes.push({ kind: "swapp", text: `${quote.client.name}: proposal accepted` });
  for (const engagement of signed) changes.push({ kind: "swapp", text: `${engagement.clientName}: GSA signed` });
  for (const engagement of paid) changes.push({ kind: "swapp", text: `${engagement.clientName}: first month paid` });

  let ga4: InternalScanResult["ga4"] = null;
  const ga4NeedsLogin = !hasGA4Credentials();
  if (hasGA4Credentials()) {
    try {
      const brands = await db.brand.findMany({
        where: { slug: { in: [...COMPANY_BRANDS] }, status: "ACTIVE" },
        select: { slug: true, theme: { select: { ga4PropertyId: true } } },
      });
      const sums = await Promise.all(
        brands.map(async (brand) => {
          const propertyId = brand.theme?.ga4PropertyId;
          if (!propertyId) return 0;
          const rows = await getTrafficTrend(propertyId, day(29), day(0));
          return rows.reduce((total, row) => total + row.sessions, 0);
        }),
      );
      const [bkc = 0, treb = 0] = sums;
      ga4 = { bkc, treb, combined: bkc + treb };
      changes.push({ kind: "ga4", text: `Traffic refreshed: ${bkc + treb} sessions last 30d` });
    } catch {
      changes.push({ kind: "ga4", text: "Traffic refresh failed; will retry next scan" });
    }
  } else {
    changes.push({ kind: "ga4", text: "Traffic refresh needs the GA key on the server" });
  }
  return { changes, ga4, ga4NeedsLogin };
}

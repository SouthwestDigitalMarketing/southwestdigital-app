import "server-only";
import { prisma } from "@/lib/prisma";
import { buildPastDueMap, type PastDueEntry } from "./matchArCustomers";

export type PastDueContact = {
  id: string;
  name: string;
  company: string | null;
};

/**
 * Past-due invoice totals per contact, from the mirrored QuickBooks aging
 * rows. Returns plain JSON for client components, plus the snapshot time.
 */
export async function getPastDueByContact(
  brandId: string,
  contacts: PastDueContact[],
  today: string,
): Promise<{ byId: Record<string, PastDueEntry>; syncedAsOf: string | null }> {
  const rows = await prisma.customerArSnapshot.findMany({
    where: { brandId },
    select: { customerName: true, dueDate: true, openBalance: true, syncedAt: true },
  });
  const map = buildPastDueMap(
    rows.map((row) => ({
      customerName: row.customerName,
      dueDate: row.dueDate,
      openBalance: Number(row.openBalance),
    })),
    contacts,
    today,
  );
  let syncedAsOf: string | null = null;
  for (const row of rows) {
    const stamp = row.syncedAt.toISOString();
    if (!syncedAsOf || stamp > syncedAsOf) syncedAsOf = stamp;
  }
  return { byId: Object.fromEntries(map), syncedAsOf };
}

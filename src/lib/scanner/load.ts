import "server-only";

import type { BrandDataContext } from "@/lib/tenancy/context";
import { withBrandDataTransaction } from "@/lib/tenancy/context";
import type { ScanListRow } from "./view";
import { isScanRoleKey } from "./vocab";

export type ScanRoleRow = { key: string; label: string; holderLabel: string | null };

export async function loadScanFindings(
  context: BrandDataContext,
  roleKey: string | null,
): Promise<{ roles: ScanRoleRow[]; findings: ScanListRow[]; role: string | null }> {
  const role = roleKey && isScanRoleKey(roleKey) ? roleKey : null;
  return withBrandDataTransaction(context, async (tx) => {
    const where = { brandId: context.brandId, ...(role ? { roleKey: role } : {}) };
    const [roles, open, closed] = await Promise.all([
      tx.scanRole.findMany({
        where: { brandId: context.brandId },
        orderBy: { label: "asc" },
        select: { key: true, label: true, holderLabel: true },
      }),
      tx.scanFinding.findMany({
        where: { ...where, state: "open" },
        orderBy: { lastSeenAt: "desc" },
        take: 200,
        select: {
          id: true,
          room: true,
          key: true,
          what: true,
          severity: true,
          evidence: true,
          state: true,
          fixLevel: true,
          roleKey: true,
          firstSeenAt: true,
          lastSeenAt: true,
          closedAt: true,
          doneNote: true,
        },
      }),
      tx.scanFinding.findMany({
        where: { ...where, state: "closed" },
        orderBy: { closedAt: "desc" },
        take: 20,
        select: {
          id: true,
          room: true,
          key: true,
          what: true,
          severity: true,
          evidence: true,
          state: true,
          fixLevel: true,
          roleKey: true,
          firstSeenAt: true,
          lastSeenAt: true,
          closedAt: true,
          doneNote: true,
        },
      }),
    ]);
    return { roles, findings: [...open, ...closed], role };
  });
}

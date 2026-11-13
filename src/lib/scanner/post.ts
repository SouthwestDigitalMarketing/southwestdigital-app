import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createBrandDataContext, withBrandDataTransaction } from "@/lib/tenancy/context";
import { applyScanFinding, type ScanIngest, type ScanWriteResult } from "./ingest";

type ScanTx = Parameters<typeof applyScanFinding>[0];

export function isScanStorageMissing(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2021" || error.code === "P2010";
  }
  return false;
}

export async function postScanFinding(args: {
  brandId: string;
  actorUserId: string;
  input: ScanIngest;
}): Promise<ScanWriteResult> {
  const context = createBrandDataContext({ brandId: args.brandId, actorUserId: args.actorUserId });
  // The generated client method types are wider than the small writer interface.
  return withBrandDataTransaction(context, (tx) => applyScanFinding(tx as unknown as ScanTx, args.brandId, args.input));
}

export async function findScannerBrand(slug: string) {
  return prisma.brand.findUnique({
    where: { slug },
    select: { id: true, slug: true, status: true, deletedAt: true },
  });
}

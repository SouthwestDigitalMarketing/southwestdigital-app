import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ServiceRecordInput } from "./serviceRecords";

/** A record that cannot be saved; `status` is the HTTP status to answer with. */
export class ServiceRecordError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 409 = 400,
  ) {
    super(message);
  }
}

/** The brand's active contact with this email: one on a deal first, else the oldest (as client-won). */
export async function contactIdByEmail(brandId: string, email: string): Promise<string | null> {
  const found = await prisma.contact.findMany({
    where: { brandId, isActive: true, email: { equals: email, mode: "insensitive" } },
    select: { id: true, leadLinks: { select: { id: true } } },
    orderBy: { createdAt: "asc" },
  });
  return (found.find((c) => c.leadLinks.length > 0) ?? found[0])?.id ?? null;
}

/**
 * Save one service record by its sourceKey (create or update). Checks the
 * contact, engagement and replaced record belong to the brand. Callers sync
 * tags afterwards (syncServiceTags).
 */
export async function upsertServiceRecord(
  brandId: string,
  input: ServiceRecordInput,
): Promise<{ id: string; sourceKey: string | null; contactId: string; created: boolean }> {
  let contactId = input.contactId;
  if (contactId) {
    const contact = await prisma.contact.findFirst({ where: { id: contactId, brandId }, select: { id: true } });
    if (!contact) throw new ServiceRecordError("contactId is not a contact of this brand.");
  } else {
    contactId = (await contactIdByEmail(brandId, input.contactEmail ?? "")) ?? "";
    if (!contactId) throw new ServiceRecordError(`no active contact with email ${input.contactEmail}`);
  }
  if (input.engagementId) {
    const engagement = await prisma.engagement.findFirst({ where: { id: input.engagementId, brandId }, select: { id: true } });
    if (!engagement) throw new ServiceRecordError("engagementId is not an engagement of this brand.");
  }
  let previousId: string | null = null;
  if (input.previousSourceKey) {
    const previous = await prisma.serviceRecord.findUnique({
      where: { brandId_sourceKey: { brandId, sourceKey: input.previousSourceKey } },
      select: { id: true },
    });
    if (!previous) throw new ServiceRecordError("previousSourceKey: no such record (load it first).");
    previousId = previous.id;
  }
  const date = (value: string) => new Date(`${value}T00:00:00Z`);
  const data = {
    contactId,
    engagementId: input.engagementId,
    product: input.product,
    basis: input.basis,
    feeAmount: input.feeAmount === null ? null : new Prisma.Decimal(input.feeAmount),
    startDate: date(input.startDate),
    endDate: input.endDate ? date(input.endDate) : null,
    endReason: input.endReason,
    evidenceSource: input.evidenceSource,
    evidenceRef: input.evidenceRef,
    evidenceDate: date(input.evidenceDate),
    notes: input.notes,
    previousId,
  };
  const where = { brandId_sourceKey: { brandId, sourceKey: input.sourceKey } };
  try {
    const existed = Boolean(await prisma.serviceRecord.findUnique({ where, select: { id: true } }));
    const record = await prisma.serviceRecord.upsert({
      where,
      create: { brandId, sourceKey: input.sourceKey, ...data },
      update: data,
      select: { id: true, sourceKey: true },
    });
    return { ...record, contactId, created: !existed };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ServiceRecordError("That record is already the replacement of another record.", 409);
    }
    throw error;
  }
}

import "server-only";

import { AuditActorType, BrandStatus, IntegrationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { saveBrandIntegrationSchema } from "./schemas";

export async function saveBrandIntegration(actorUserId: string, input: unknown) {
  const values = saveBrandIntegrationSchema.parse(input);

  return prisma.$transaction(async (transaction) => {
    const brand = await transaction.brand.findFirst({
      where: { id: values.brandId, status: { not: BrandStatus.DELETED } },
      select: { id: true },
    });
    if (!brand) throw new Error("Brand not found");

    const existingIntegration = await transaction.brandIntegration.findUnique({
      where: { brandId_key: { brandId: brand.id, key: values.key } },
      select: { id: true },
    });
    const integration = await transaction.brandIntegration.upsert({
      where: { brandId_key: { brandId: brand.id, key: values.key } },
      create: {
        brandId: brand.id,
        key: values.key,
        provider: values.provider,
        status: IntegrationStatus.PENDING,
        assetOwner: values.assetOwner,
        displayName: values.displayName,
        externalAccountId: values.externalAccountId,
        externalPropertyId: values.externalPropertyId,
        publicIdentifier: values.publicIdentifier,
        notes: values.notes,
      },
      update: {
        provider: values.provider,
        status: IntegrationStatus.PENDING,
        assetOwner: values.assetOwner,
        displayName: values.displayName,
        externalAccountId: values.externalAccountId,
        externalPropertyId: values.externalPropertyId,
        publicIdentifier: values.publicIdentifier,
        notes: values.notes,
        lastVerifiedAt: null,
        lastErrorAt: null,
        lastErrorCode: null,
      },
    });

    await transaction.auditEvent.create({
      data: {
        brandId: brand.id,
        actorUserId,
        actorType: AuditActorType.USER,
        action: existingIntegration ? "brand.integration.updated" : "brand.integration.created",
        resourceType: "BrandIntegration",
        resourceId: integration.id,
        metadata: {
          key: integration.key,
          provider: integration.provider,
          assetOwner: integration.assetOwner,
          status: integration.status,
        },
      },
    });

    return integration;
  });
}

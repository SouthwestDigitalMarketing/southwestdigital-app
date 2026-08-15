import "server-only";

import {
  AuditActorType,
  BrandDataExportFormat,
  BrandDataExportStatus,
  BrandStatus,
  DomainPurpose,
  DomainStatus,
  IntegrationStatus,
  MembershipStatus,
  OffboardingPlanStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  beginBrandOffboardingSchema,
  cancelBrandOffboardingSchema,
  implementedExportScopes,
  requestBrandDataExportSchema,
  scheduleBrandOffboardingSchema,
} from "./schemas";

export const availableExportScopes = implementedExportScopes;

function canEnterOffboarding(status: BrandStatus): boolean {
  return status === BrandStatus.ACTIVE || status === BrandStatus.SUSPENDED;
}

export async function requestBrandDataExport(actorUserId: string, input: unknown) {
  const values = requestBrandDataExportSchema.parse(input);

  return prisma.$transaction(async (transaction) => {
    const brand = await transaction.brand.findFirst({
      where: { id: values.brandId, status: { not: BrandStatus.DELETED } },
      select: { id: true },
    });
    if (!brand) throw new Error("Brand not found");

    const activeExport = await transaction.brandDataExport.findFirst({
      where: {
        brandId: brand.id,
        status: { in: [BrandDataExportStatus.REQUESTED, BrandDataExportStatus.PROCESSING] },
      },
      orderBy: { requestedAt: "desc" },
    });
    if (activeExport) return activeExport;

    const dataExport = await transaction.brandDataExport.create({
      data: {
        brandId: brand.id,
        requestedByUserId: actorUserId,
        status: BrandDataExportStatus.REQUESTED,
        format: BrandDataExportFormat.JSONL_ZIP_V1,
        requestedScopes: values.scopes,
      },
    });
    await transaction.auditEvent.create({
      data: {
        brandId: brand.id,
        actorUserId,
        actorType: AuditActorType.USER,
        action: "brand.data_export.requested",
        resourceType: "BrandDataExport",
        resourceId: dataExport.id,
        metadata: { format: dataExport.format, scopes: dataExport.requestedScopes },
      },
    });
    return dataExport;
  });
}

export async function scheduleBrandOffboarding(actorUserId: string, input: unknown) {
  const values = scheduleBrandOffboardingSchema.parse(input);

  return prisma.$transaction(async (transaction) => {
    const brand = await transaction.brand.findFirst({
      where: { id: values.brandId },
      select: { id: true, slug: true, status: true },
    });
    if (!brand) throw new Error("Brand not found");
    if (brand.slug !== values.confirmSlug.toLowerCase()) {
      throw new Error("Brand slug confirmation does not match");
    }
    if (!canEnterOffboarding(brand.status)) {
      throw new Error("Only active or suspended brands can enter offboarding");
    }

    const livePlan = await transaction.brandOffboardingPlan.findFirst({
      where: {
        brandId: brand.id,
        status: { in: [OffboardingPlanStatus.PLANNED, OffboardingPlanStatus.IN_PROGRESS] },
      },
      select: { id: true },
    });
    if (livePlan) throw new Error("This brand already has a live offboarding plan");

    const plan = await transaction.brandOffboardingPlan.create({
      data: {
        brandId: brand.id,
        initiatedByUserId: actorUserId,
        serviceEndsAt: values.serviceEndsAt,
        accessEndsAt: values.accessEndsAt,
        retentionEndsAt: values.retentionEndsAt,
        reason: values.reason,
      },
    });
    await transaction.brand.update({
      where: { id: brand.id },
      data: {
        subscriptionEndedAt: values.serviceEndsAt,
        accessEndsAt: values.accessEndsAt,
        retentionEndsAt: values.retentionEndsAt,
      },
    });
    await transaction.auditEvent.create({
      data: {
        brandId: brand.id,
        actorUserId,
        actorType: AuditActorType.USER,
        action: "brand.offboarding.scheduled",
        resourceType: "BrandOffboardingPlan",
        resourceId: plan.id,
        metadata: {
          serviceEndsAt: plan.serviceEndsAt.toISOString(),
          accessEndsAt: plan.accessEndsAt.toISOString(),
          retentionEndsAt: plan.retentionEndsAt.toISOString(),
        },
      },
    });
    return plan;
  });
}

export async function beginBrandOffboarding(actorUserId: string, input: unknown) {
  const values = beginBrandOffboardingSchema.parse(input);
  const now = new Date();

  return prisma.$transaction(async (transaction) => {
    const plan = await transaction.brandOffboardingPlan.findUnique({
      where: { id: values.planId },
      include: { brand: { select: { id: true, slug: true, status: true } } },
    });
    if (!plan || plan.status !== OffboardingPlanStatus.PLANNED) {
      throw new Error("Planned offboarding not found");
    }
    if (plan.brand.slug !== values.confirmSlug.toLowerCase()) {
      throw new Error("Brand slug confirmation does not match");
    }
    if (plan.accessEndsAt > now) {
      throw new Error("Access cannot be revoked before the scheduled instant");
    }
    if (!canEnterOffboarding(plan.brand.status)) {
      throw new Error("Brand cannot begin offboarding from its current state");
    }

    await Promise.all([
      transaction.brand.update({
        where: { id: plan.brand.id },
        data: { status: BrandStatus.OFFBOARDING },
      }),
      transaction.brandOffboardingPlan.update({
        where: { id: plan.id },
        data: { status: OffboardingPlanStatus.IN_PROGRESS, startedAt: now },
      }),
      transaction.brandMembership.updateMany({
        where: { brandId: plan.brand.id, status: { not: MembershipStatus.SUSPENDED } },
        data: { status: MembershipStatus.SUSPENDED },
      }),
      transaction.brandIntegration.updateMany({
        where: { brandId: plan.brand.id, status: { not: IntegrationStatus.SUSPENDED } },
        data: { status: IntegrationStatus.SUSPENDED },
      }),
      transaction.brandDomain.updateMany({
        where: {
          brandId: plan.brand.id,
          purpose: DomainPurpose.APP,
          status: { not: DomainStatus.DISABLED },
        },
        data: { status: DomainStatus.DISABLED, verifiedAt: null },
      }),
    ]);

    let dataExport = await transaction.brandDataExport.findFirst({
      where: {
        brandId: plan.brand.id,
        status: { in: [BrandDataExportStatus.REQUESTED, BrandDataExportStatus.PROCESSING] },
      },
      orderBy: { requestedAt: "desc" },
    });
    if (!dataExport) {
      dataExport = await transaction.brandDataExport.create({
        data: {
          brandId: plan.brand.id,
          offboardingPlanId: plan.id,
          requestedByUserId: actorUserId,
          status: BrandDataExportStatus.REQUESTED,
          format: BrandDataExportFormat.JSONL_ZIP_V1,
          requestedScopes: [...availableExportScopes],
        },
      });
    }

    await transaction.auditEvent.create({
      data: {
        brandId: plan.brand.id,
        actorUserId,
        actorType: AuditActorType.USER,
        action: "brand.offboarding.started",
        resourceType: "BrandOffboardingPlan",
        resourceId: plan.id,
        metadata: { dataExportId: dataExport.id, accessRevokedAt: now.toISOString() },
      },
    });
    return { planId: plan.id, dataExportId: dataExport.id };
  });
}

export async function cancelBrandOffboarding(actorUserId: string, input: unknown) {
  const values = cancelBrandOffboardingSchema.parse(input);
  const now = new Date();

  return prisma.$transaction(async (transaction) => {
    const plan = await transaction.brandOffboardingPlan.findUnique({
      where: { id: values.planId },
      include: { brand: { select: { id: true, slug: true } } },
    });
    if (!plan || plan.status !== OffboardingPlanStatus.PLANNED) {
      throw new Error("Planned offboarding not found");
    }
    if (plan.brand.slug !== values.confirmSlug.toLowerCase()) {
      throw new Error("Brand slug confirmation does not match");
    }

    await transaction.brandOffboardingPlan.update({
      where: { id: plan.id },
      data: { status: OffboardingPlanStatus.CANCELLED, cancelledAt: now },
    });
    await transaction.brand.update({
      where: { id: plan.brand.id },
      data: { subscriptionEndedAt: null, accessEndsAt: null, retentionEndsAt: null },
    });
    await transaction.auditEvent.create({
      data: {
        brandId: plan.brand.id,
        actorUserId,
        actorType: AuditActorType.USER,
        action: "brand.offboarding.cancelled",
        resourceType: "BrandOffboardingPlan",
        resourceId: plan.id,
        metadata: { cancelledAt: now.toISOString() },
      },
    });
    return { planId: plan.id };
  });
}

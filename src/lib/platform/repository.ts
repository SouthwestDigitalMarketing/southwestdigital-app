import "server-only";

import {
  AuditActorType,
  BrandRole,
  BrandStatus,
  DomainStatus,
  MembershipStatus,
  Prisma,
  UserStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  addBrandDomainSchema,
  createBrandOnboardingSchema,
  inviteBrandMemberSchema,
  updateBrandThemeSchema,
} from "./schemas";

const brandAdministrationSelect = {
  id: true,
  name: true,
  legalName: true,
  slug: true,
  status: true,
  createdAt: true,
  subscriptionStartedAt: true,
  accessEndsAt: true,
  retentionEndsAt: true,
  theme: true,
  domains: {
    orderBy: [{ purpose: "asc" }, { isPrimary: "desc" }, { hostname: "asc" }],
  },
  memberships: {
    orderBy: [{ role: "desc" }, { user: { email: "asc" } }],
    select: {
      id: true,
      role: true,
      status: true,
      user: { select: { id: true, name: true, email: true, status: true } },
    },
  },
} satisfies Prisma.BrandSelect;

export async function listBrandsForAdministration() {
  return prisma.brand.findMany({
    where: { status: { not: BrandStatus.DELETED } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      domains: {
        where: { isPrimary: true },
        orderBy: { purpose: "asc" },
        select: { hostname: true, purpose: true, status: true },
      },
      _count: { select: { memberships: true, contacts: true, leads: true } },
    },
  });
}

export async function getBrandForAdministration(brandId: string) {
  return prisma.brand.findFirst({
    where: { id: brandId, status: { not: BrandStatus.DELETED } },
    select: brandAdministrationSelect,
  });
}

export async function createBrandOnboarding(
  actorUserId: string,
  input: unknown,
) {
  const values = createBrandOnboardingSchema.parse(input);

  return prisma.$transaction(async (transaction) => {
    const existingOwner = await transaction.user.findUnique({
      where: { email: values.ownerEmail },
    });

    if (existingOwner?.status === UserStatus.SUSPENDED) {
      throw new Error("The proposed brand owner is globally suspended");
    }

    const owner =
      existingOwner ??
      (await transaction.user.create({
        data: {
          email: values.ownerEmail,
          name: values.ownerName,
          status: UserStatus.INVITED,
        },
      }));

    const brand = await transaction.brand.create({
      data: {
        name: values.name,
        legalName: values.legalName,
        slug: values.slug,
        status: BrandStatus.DRAFT,
        theme: {
          create: {
            logoUrl: values.logoUrl,
            logoAlt: `${values.name} logo`,
            primaryColor: values.primaryColor,
            accentColor: values.accentColor,
            backgroundColor: values.backgroundColor,
            foregroundColor: values.foregroundColor,
            supportEmail: values.supportEmail,
          },
        },
        domains: {
          create: {
            hostname: values.appHostname,
            status: DomainStatus.PENDING,
            isPrimary: true,
          },
        },
        memberships: {
          create: {
            userId: owner.id,
            role: BrandRole.OWNER,
            status:
              owner.status === UserStatus.ACTIVE
                ? MembershipStatus.ACTIVE
                : MembershipStatus.INVITED,
          },
        },
      },
      select: { id: true },
    });

    await transaction.auditEvent.create({
      data: {
        brandId: brand.id,
        actorUserId,
        actorType: AuditActorType.USER,
        action: "brand.onboarding.created",
        resourceType: "Brand",
        resourceId: brand.id,
        metadata: {
          ownerUserId: owner.id,
          appHostname: values.appHostname,
          initialStatus: BrandStatus.DRAFT,
          domainStatus: DomainStatus.PENDING,
        },
      },
    });

    return brand;
  });
}

export async function addPendingBrandDomain(
  actorUserId: string,
  input: unknown,
) {
  const values = addBrandDomainSchema.parse(input);

  return prisma.$transaction(async (transaction) => {
    const brand = await transaction.brand.findFirst({
      where: { id: values.brandId, status: { not: BrandStatus.DELETED } },
      select: { id: true },
    });
    if (!brand) throw new Error("Brand not found");

    const domain = await transaction.brandDomain.create({
      data: {
        brandId: brand.id,
        hostname: values.hostname,
        purpose: values.purpose,
        status: DomainStatus.PENDING,
        isPrimary: false,
      },
    });

    await transaction.auditEvent.create({
      data: {
        brandId: brand.id,
        actorUserId,
        actorType: AuditActorType.USER,
        action: "brand.domain.added",
        resourceType: "BrandDomain",
        resourceId: domain.id,
        metadata: { hostname: domain.hostname, purpose: domain.purpose, status: domain.status },
      },
    });

    return domain;
  });
}

export async function updateBrandTheme(
  actorUserId: string,
  input: unknown,
) {
  const values = updateBrandThemeSchema.parse(input);

  return prisma.$transaction(async (transaction) => {
    const brand = await transaction.brand.findFirst({
      where: { id: values.brandId, status: { not: BrandStatus.DELETED } },
      select: { id: true, name: true },
    });
    if (!brand) throw new Error("Brand not found");

    const theme = await transaction.brandTheme.upsert({
      where: { brandId: brand.id },
      create: {
        brandId: brand.id,
        logoUrl: values.logoUrl,
        logoAlt: `${brand.name} logo`,
        supportEmail: values.supportEmail,
        primaryColor: values.primaryColor,
        accentColor: values.accentColor,
        backgroundColor: values.backgroundColor,
        foregroundColor: values.foregroundColor,
      },
      update: {
        logoUrl: values.logoUrl,
        supportEmail: values.supportEmail,
        primaryColor: values.primaryColor,
        accentColor: values.accentColor,
        backgroundColor: values.backgroundColor,
        foregroundColor: values.foregroundColor,
      },
    });

    await transaction.auditEvent.create({
      data: {
        brandId: brand.id,
        actorUserId,
        actorType: AuditActorType.USER,
        action: "brand.theme.updated",
        resourceType: "BrandTheme",
        resourceId: theme.id,
      },
    });

    return theme;
  });
}

export async function inviteBrandMember(
  actorUserId: string,
  input: unknown,
) {
  const values = inviteBrandMemberSchema.parse(input);

  return prisma.$transaction(async (transaction) => {
    const brand = await transaction.brand.findFirst({
      where: { id: values.brandId, status: { not: BrandStatus.DELETED } },
      select: { id: true },
    });
    if (!brand) throw new Error("Brand not found");

    const existingUser = await transaction.user.findUnique({ where: { email: values.email } });
    if (existingUser?.status === UserStatus.SUSPENDED) {
      throw new Error("This user is globally suspended");
    }

    const user =
      existingUser ??
      (await transaction.user.create({
        data: { email: values.email, name: values.name, status: UserStatus.INVITED },
      }));
    const existingMembership = await transaction.brandMembership.findUnique({
      where: { brandId_userId: { brandId: brand.id, userId: user.id } },
    });
    const membershipStatus =
      existingMembership?.status === MembershipStatus.ACTIVE || user.status === UserStatus.ACTIVE
        ? MembershipStatus.ACTIVE
        : MembershipStatus.INVITED;

    const membership = await transaction.brandMembership.upsert({
      where: { brandId_userId: { brandId: brand.id, userId: user.id } },
      create: {
        brandId: brand.id,
        userId: user.id,
        role: values.role,
        status: membershipStatus,
      },
      update: { role: values.role, status: membershipStatus },
    });

    await transaction.auditEvent.create({
      data: {
        brandId: brand.id,
        actorUserId,
        actorType: AuditActorType.USER,
        action: existingMembership ? "brand.membership.updated" : "brand.membership.invited",
        resourceType: "BrandMembership",
        resourceId: membership.id,
        metadata: { userId: user.id, role: membership.role, status: membership.status },
      },
    });

    return membership;
  });
}

import {
  AuditActorType,
  BrandRole,
  BrandStatus,
  DomainPurpose,
  DomainStatus,
  IntegrationAssetOwner,
  IntegrationProvider,
  IntegrationStatus,
  MembershipStatus,
  PlatformRole,
  PrismaClient,
  UserStatus,
} from "@prisma/client";

if (process.env.ALLOW_INITIAL_BRAND_SEED !== "true") {
  throw new Error("Refusing to seed without ALLOW_INITIAL_BRAND_SEED=true");
}

const normalizeEmail = (value) => value.trim().normalize("NFKC").toLowerCase();
const requiredEmail = (name) => {
  const value = process.env[name];
  if (!value || !value.includes("@")) throw new Error(`${name} must be a valid email address`);
  return normalizeEmail(value);
};

const bookkeepingOwnerEmail = requiredEmail("INITIAL_BOOKKEEPING_OWNER_EMAIL");
const platformOwnerEmail = normalizeEmail(
  process.env.INITIAL_PLATFORM_OWNER_EMAIL || bookkeepingOwnerEmail,
);
const dagnyEmail = normalizeEmail(process.env.INITIAL_DAGNY_EMAIL || "dagnymotor@gmail.com");

const brands = [
  {
    slug: "southwest-digital-marketing",
    name: "Southwest Digital Marketing",
    appHostname: "app.southwestdigital.io",
    ownerEmail: platformOwnerEmail,
    supportEmail: "hello@southwestdigital.io",
    theme: {
      primaryColor: "#0a1628",
      accentColor: "#2563eb",
      backgroundColor: "#f0f4fa",
      foregroundColor: "#0a1628",
    },
    integrations: [
      {
        key: "website-gtm",
        provider: IntegrationProvider.GTM,
        displayName: "Southwest Digital website GTM",
        publicIdentifier: "GTM-5KW4C4TM",
      },
    ],
  },
  {
    slug: "bookkeeping-conroe",
    name: "Bookkeeping Conroe",
    appHostname: "app.bookkeepingconroe.com",
    ownerEmail: bookkeepingOwnerEmail,
    supportEmail: "contact@bookkeepingconroe.com",
    theme: {
      primaryColor: "#1b263b",
      accentColor: "#f8d773",
      backgroundColor: "#f8fafc",
      foregroundColor: "#0f172a",
    },
    integrations: [],
  },
  {
    slug: "contigo-accounting",
    name: "Contigo Accounting",
    appHostname: "app.contigoaccounting.com",
    ownerEmail: dagnyEmail,
    supportEmail: "contact@contigoaccounting.com",
    theme: {
      primaryColor: "#0d7fa6",
      accentColor: "#f37b22",
      backgroundColor: "#ffffff",
      foregroundColor: "#0b2b4b",
    },
    integrations: [
      {
        key: "website-gtm",
        provider: IntegrationProvider.GTM,
        displayName: "Contigo website GTM",
        publicIdentifier: "GTM-KN9CL5LR",
      },
    ],
  },
  {
    slug: "melbourne-cfo",
    name: "Melbourne CFO",
    appHostname: "app.melbournecfo.com.au",
    ownerEmail: dagnyEmail,
    supportEmail: "hello@melbournecfo.com.au",
    theme: {
      primaryColor: "#020617",
      accentColor: "#c8a96a",
      backgroundColor: "#050a12",
      foregroundColor: "#ffffff",
    },
    integrations: [
      {
        key: "website-gtm",
        provider: IntegrationProvider.GTM,
        displayName: "Melbourne CFO website GTM",
        publicIdentifier: "GTM-TJS6TZK8",
      },
    ],
  },
];

const prisma = new PrismaClient();

async function ensureUser(transaction, email, platformRole = PlatformRole.NONE) {
  const existing = await transaction.user.findUnique({ where: { email } });
  if (existing) {
    if (platformRole === PlatformRole.OWNER && existing.platformRole !== PlatformRole.OWNER) {
      return transaction.user.update({
        where: { id: existing.id },
        data: { platformRole: PlatformRole.OWNER },
      });
    }
    return existing;
  }

  return transaction.user.create({
    data: { email, status: UserStatus.INVITED, platformRole },
  });
}

async function seed() {
  const result = await prisma.$transaction(async (transaction) => {
    await ensureUser(transaction, platformOwnerEmail, PlatformRole.OWNER);
    const brandIds = {};

    for (const definition of brands) {
      const owner = await ensureUser(transaction, definition.ownerEmail);
      const brand = await transaction.brand.upsert({
        where: { slug: definition.slug },
        create: {
          slug: definition.slug,
          name: definition.name,
          status: BrandStatus.DRAFT,
        },
        update: { name: definition.name },
      });
      brandIds[definition.slug] = brand.id;

      await transaction.brandTheme.upsert({
        where: { brandId: brand.id },
        create: {
          brandId: brand.id,
          logoAlt: `${definition.name} logo`,
          supportEmail: definition.supportEmail,
          ...definition.theme,
        },
        update: {
          logoAlt: `${definition.name} logo`,
          supportEmail: definition.supportEmail,
          ...definition.theme,
        },
      });

      const existingDomain = await transaction.brandDomain.findUnique({
        where: { hostname: definition.appHostname },
      });
      if (existingDomain && existingDomain.brandId !== brand.id) {
        throw new Error(`${definition.appHostname} is already attached to another brand`);
      }
      if (!existingDomain) {
        await transaction.brandDomain.create({
          data: {
            brandId: brand.id,
            hostname: definition.appHostname,
            purpose: DomainPurpose.APP,
            status: DomainStatus.PENDING,
            isPrimary: true,
          },
        });
      }

      await transaction.brandMembership.upsert({
        where: { brandId_userId: { brandId: brand.id, userId: owner.id } },
        create: {
          brandId: brand.id,
          userId: owner.id,
          role: BrandRole.OWNER,
          status: MembershipStatus.INVITED,
        },
        update: { role: BrandRole.OWNER },
      });

      for (const integration of definition.integrations) {
        await transaction.brandIntegration.upsert({
          where: { brandId_key: { brandId: brand.id, key: integration.key } },
          create: {
            brandId: brand.id,
            status: IntegrationStatus.PENDING,
            assetOwner: IntegrationAssetOwner.SOUTHWEST_DIGITAL,
            ...integration,
          },
          update: {
            assetOwner: IntegrationAssetOwner.SOUTHWEST_DIGITAL,
            provider: integration.provider,
            displayName: integration.displayName,
            publicIdentifier: integration.publicIdentifier,
          },
        });
      }
    }

    const bookkeepingOwner = await transaction.user.findUniqueOrThrow({
      where: { email: bookkeepingOwnerEmail },
    });
    const bookkeepingBrandId = brandIds["bookkeeping-conroe"];
    await transaction.brandMembership.upsert({
      where: { brandId_userId: { brandId: bookkeepingBrandId, userId: bookkeepingOwner.id } },
      create: {
        brandId: bookkeepingBrandId,
        userId: bookkeepingOwner.id,
        role: BrandRole.OWNER,
        status: MembershipStatus.INVITED,
      },
      update: { role: BrandRole.OWNER },
    });

    await transaction.auditEvent.create({
      data: {
        actorType: AuditActorType.SYSTEM,
        action: "platform.initial_brand_seed.applied",
        resourceType: "Platform",
        metadata: {
          brandSlugs: brands.map(({ slug }) => slug),
          hostnames: brands.map(({ appHostname }) => appHostname),
        },
      },
    });

    return brandIds;
  });

  process.stdout.write(`${JSON.stringify({ seededBrandSlugs: Object.keys(result) })}\n`);
}

seed()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

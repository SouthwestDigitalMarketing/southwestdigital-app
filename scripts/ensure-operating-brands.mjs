import {
  BrandRole,
  BrandStatus,
  DomainPurpose,
  DomainStatus,
  MembershipStatus,
  PrismaClient,
  UserStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

const brands = [
  {
    slug: "southwest-digital-marketing",
    name: "Southwest Digital Marketing",
    appHostname: "app.southwestdigital.io",
    ownerEmail: "thomas@bookkeepingconroe.com",
    supportEmail: "hello@southwestdigital.io",
    theme: {
      primaryColor: "#0a1628",
      accentColor: "#2563eb",
      backgroundColor: "#f0f4fa",
      foregroundColor: "#0a1628",
    },
  },
  {
    slug: "bc",
    name: "Bookkeeping Conroe",
    appHostname: "app.bookkeepingconroe.com",
    ownerEmail: "thomas@bookkeepingconroe.com",
    supportEmail: "contact@bookkeepingconroe.com",
    theme: {
      primaryColor: "#1b263b",
      accentColor: "#f8d773",
      backgroundColor: "#f8fafc",
      foregroundColor: "#0f172a",
    },
  },
  {
    slug: "contigo-accounting",
    name: "Contigo Accounting",
    appHostname: "app.contigoaccounting.com",
    ownerEmail: "dagnymotor@gmail.com",
    supportEmail: "contact@contigoaccounting.com",
    theme: {
      primaryColor: "#0d7fa6",
      accentColor: "#f37b22",
      backgroundColor: "#ffffff",
      foregroundColor: "#0b2b4b",
    },
  },
  {
    slug: "melbourne-cfo",
    name: "Melbourne CFO",
    appHostname: "app.melbournecfo.com.au",
    ownerEmail: "dagnymotor@gmail.com",
    supportEmail: "hello@melbournecfo.com.au",
    theme: {
      primaryColor: "#020617",
      accentColor: "#c8a96a",
      backgroundColor: "#050a12",
      foregroundColor: "#ffffff",
    },
  },
];

async function ensureUser(email, name) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  return prisma.user.create({
    data: { email, name, status: UserStatus.ACTIVE, platformRole: "NONE" },
  });
}

async function ensureBrand(definition) {
  const owner = await ensureUser(definition.ownerEmail, definition.ownerEmail.split("@")[0]);

  const brand = await prisma.brand.upsert({
    where: { slug: definition.slug },
    create: {
      slug: definition.slug,
      name: definition.name,
      status: BrandStatus.ACTIVE,
    },
    update: {
      name: definition.name,
      status: BrandStatus.ACTIVE,
    },
  });

  await prisma.brandTheme.upsert({
    where: { brandId: brand.id },
    create: {
      brandId: brand.id,
      logoAlt: `${definition.name} logo`,
      supportEmail: definition.supportEmail,
      ...definition.theme,
    },
    update: {},
  });

  const existingDomain = await prisma.brandDomain.findUnique({
    where: { hostname: definition.appHostname },
  });
  if (existingDomain && existingDomain.brandId !== brand.id) {
    throw new Error(`${definition.appHostname} is already attached to another brand`);
  }
  if (existingDomain) {
    await prisma.brandDomain.update({
      where: { id: existingDomain.id },
      data: {
        purpose: DomainPurpose.APP,
        status: DomainStatus.VERIFIED,
        isPrimary: true,
        verifiedAt: existingDomain.verifiedAt ?? new Date(),
      },
    });
  } else {
    await prisma.brandDomain.create({
      data: {
        brandId: brand.id,
        hostname: definition.appHostname,
        purpose: DomainPurpose.APP,
        status: DomainStatus.VERIFIED,
        isPrimary: true,
        verifiedAt: new Date(),
      },
    });
  }

  await prisma.brandMembership.upsert({
    where: { brandId_userId: { brandId: brand.id, userId: owner.id } },
    create: {
      brandId: brand.id,
      userId: owner.id,
      role: BrandRole.OWNER,
      status: MembershipStatus.ACTIVE,
    },
    update: {
      role: BrandRole.OWNER,
      status: MembershipStatus.ACTIVE,
    },
  });

  return { slug: brand.slug, hostname: definition.appHostname, ownerEmail: definition.ownerEmail };
}

const result = [];
for (const definition of brands) {
  result.push(await ensureBrand(definition));
}

console.log(JSON.stringify({ ensured: result }, null, 2));
await prisma.$disconnect();

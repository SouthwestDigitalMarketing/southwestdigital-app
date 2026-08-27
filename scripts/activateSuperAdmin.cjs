/**
 * Ensures thomas@bookkeepingconroe.com exists as an ACTIVE PlatformRole.OWNER
 * with a BrandMembership in the BC brand as BrandRole.OWNER.
 *
 * Run with: node scripts/activateSuperAdmin.cjs
 */
require("dotenv").config({ path: ".env.local" });
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const EMAIL = "thomas@bookkeepingconroe.com";
const NAME = "Thomas MacDonald";
const BC_BRAND_SLUG = "bc";

async function main() {
  // Ensure user exists and is ACTIVE OWNER
  let user = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: { id: true, name: true, email: true, platformRole: true, status: true },
  });

  if (user) {
    if (user.status !== "ACTIVE" || user.platformRole !== "OWNER") {
      user = await prisma.user.update({
        where: { email: EMAIL },
        data: { status: "ACTIVE", platformRole: "OWNER" },
        select: { id: true, name: true, email: true, platformRole: true, status: true },
      });
      console.log("Updated user:", user);
    } else {
      console.log("User already ACTIVE OWNER — no changes needed.");
    }
  } else {
    user = await prisma.user.create({
      data: { email: EMAIL, name: NAME, platformRole: "OWNER", status: "ACTIVE" },
      select: { id: true, name: true, email: true, platformRole: true, status: true },
    });
    console.log("Created user:", user);
  }

  // Ensure BC brand exists
  const brand = await prisma.brand.findUnique({
    where: { slug: BC_BRAND_SLUG },
    select: { id: true, name: true, slug: true },
  });

  if (!brand) {
    console.log(`Brand "${BC_BRAND_SLUG}" not found. Run the migration script first.`);
    return;
  }

  console.log("Brand:", brand);

  // Ensure BrandMembership exists
  const existing = await prisma.brandMembership.findUnique({
    where: { brandId_userId: { brandId: brand.id, userId: user.id } },
    select: { id: true, role: true, status: true },
  });

  if (existing) {
    if (existing.role !== "OWNER" || existing.status !== "ACTIVE") {
      const updated = await prisma.brandMembership.update({
        where: { id: existing.id },
        data: { role: "OWNER", status: "ACTIVE" },
        select: { id: true, role: true, status: true },
      });
      console.log("Updated membership:", updated);
    } else {
      console.log("Membership already ACTIVE OWNER — no changes needed.");
    }
  } else {
    const created = await prisma.brandMembership.create({
      data: {
        brandId: brand.id,
        userId: user.id,
        role: "OWNER",
        status: "ACTIVE",
      },
      select: { id: true, role: true, status: true },
    });
    console.log("Created membership:", created);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { IntegrationProvider, IntegrationStatus, PrismaClient, ReviewChannel } from "@prisma/client";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return;
  const content = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (!line.startsWith("DATABASE_URL=")) continue;
    let value = line.slice("DATABASE_URL=".length);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env.DATABASE_URL = value;
    return;
  }
  throw new Error("DATABASE_URL missing; cannot seed review fixtures.");
}

loadDatabaseUrl();

const prisma = new PrismaClient();

export const E2E_REVIEW_PHONE = "+15555550100";
export const E2E_GOOGLE_REVIEW_URL = "https://maps.google.com/?q=e2e-review-destination";
const GOOGLE_KEY = "google-review";

type GoogleRestore = {
  id: string;
  publicIdentifier: string | null;
  status: IntegrationStatus;
} | null;

export async function seedPublicReviewRequest() {
  const brand = await prisma.brand.findFirst({
    where: { slug: "bc" },
    select: { id: true, name: true },
  });
  if (!brand) throw new Error("Brand slug bc is required for review e2e fixtures.");

  const previousGoogle = await prisma.brandIntegration.findUnique({
    where: { brandId_key: { brandId: brand.id, key: GOOGLE_KEY } },
    select: { id: true, publicIdentifier: true, status: true },
  });

  await prisma.brandIntegration.upsert({
    where: { brandId_key: { brandId: brand.id, key: GOOGLE_KEY } },
    create: {
      brandId: brand.id,
      key: GOOGLE_KEY,
      provider: IntegrationProvider.OTHER,
      status: IntegrationStatus.ACTIVE,
      displayName: "Google review (e2e)",
      publicIdentifier: E2E_GOOGLE_REVIEW_URL,
    },
    update: {
      status: IntegrationStatus.ACTIVE,
      publicIdentifier: E2E_GOOGLE_REVIEW_URL,
    },
  });

  const token = `e2e-review-${randomBytes(8).toString("hex")}`;
  const row = await prisma.reviewRequest.create({
    data: {
      brandId: brand.id,
      token,
      channel: ReviewChannel.SMS,
      recipientName: "E2E Reviewer",
      recipientPhone: E2E_REVIEW_PHONE,
    },
    select: { id: true, token: true },
  });
  return { ...row, brandName: brand.name, brandId: brand.id, googleRestore: previousGoogle as GoogleRestore };
}

export async function deleteReviewRequest(
  id: string,
  restore?: { brandId: string; googleRestore: GoogleRestore },
) {
  await prisma.reviewRequest.deleteMany({ where: { id } });
  if (!restore) return;
  if (!restore.googleRestore) {
    await prisma.brandIntegration.deleteMany({
      where: { brandId: restore.brandId, key: GOOGLE_KEY, publicIdentifier: E2E_GOOGLE_REVIEW_URL },
    });
    return;
  }
  await prisma.brandIntegration.update({
    where: { id: restore.googleRestore.id },
    data: {
      publicIdentifier: restore.googleRestore.publicIdentifier,
      status: restore.googleRestore.status,
    },
  });
}

export async function disconnectReviewFixture() {
  await prisma.$disconnect();
}

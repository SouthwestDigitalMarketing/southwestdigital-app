import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, ReviewChannel } from "@prisma/client";

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

export async function seedPublicReviewRequest() {
  const brand = await prisma.brand.findFirst({
    where: { slug: "bc" },
    select: { id: true, name: true },
  });
  if (!brand) throw new Error("Brand slug bc is required for review e2e fixtures.");

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
  return { ...row, brandName: brand.name };
}

export async function deleteReviewRequest(id: string) {
  await prisma.reviewRequest.deleteMany({ where: { id } });
}

export async function disconnectReviewFixture() {
  await prisma.$disconnect();
}

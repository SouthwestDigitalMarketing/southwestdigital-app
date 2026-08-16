import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

// Next.js dev uses dotenv-expand, which can mangle DATABASE_URL values
// containing $ characters. Read the raw value directly in development.
function readRawDatabaseUrl(): string | undefined {
  if (process.env.NODE_ENV !== "development") return undefined;
  for (const filename of [".env.development.local", ".env.local"]) {
    try {
      const content = readFileSync(join(process.cwd(), filename), "utf8");
      for (const line of content.split(/\r?\n/)) {
        if (!line.startsWith("DATABASE_URL=")) continue;
        let value = line.slice("DATABASE_URL=".length);
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        return value;
      }
    } catch {}
  }
  return undefined;
}

const rawDatabaseUrl = readRawDatabaseUrl();
if (rawDatabaseUrl) {
  process.env.DATABASE_URL = rawDatabaseUrl;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV === "development") {
  const p = prisma as PrismaClient & { brandMembership?: unknown };
  if (typeof p.brandMembership === "undefined") {
    console.error(
      "[prisma] Missing brandMembership delegate. Your Prisma client is stale. Run `npm run prisma:generate` and restart the dev server.",
    );
  }
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  prisma.$queryRaw`SELECT 1`.catch(() => {});
}

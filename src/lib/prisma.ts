import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  southwestDigitalPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.southwestDigitalPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.southwestDigitalPrisma = prisma;
}


import { IntegrationAssetOwner, IntegrationProvider } from "@prisma/client";
import { z } from "zod";

const optionalText = (maximum: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(maximum).optional(),
  );

export const saveBrandIntegrationSchema = z.object({
  brandId: z.string().trim().min(1).max(64),
  key: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens"),
  provider: z.enum(IntegrationProvider),
  assetOwner: z.enum(IntegrationAssetOwner).default(IntegrationAssetOwner.BRAND),
  displayName: optionalText(200),
  externalAccountId: optionalText(240),
  externalPropertyId: optionalText(240),
  publicIdentifier: optionalText(500),
  notes: optionalText(4000),
});

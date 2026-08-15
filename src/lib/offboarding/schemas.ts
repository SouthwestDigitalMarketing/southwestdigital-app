import { BrandDataExportScope } from "@prisma/client";
import { z } from "zod";

const identifier = z.string().trim().min(1).max(64);
const instant = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

export const requestBrandDataExportSchema = z.object({
  brandId: identifier,
  scopes: z.array(z.enum(BrandDataExportScope)).min(1).max(10),
});

export const scheduleBrandOffboardingSchema = z
  .object({
    brandId: identifier,
    confirmSlug: z.string().trim().min(1).max(80),
    serviceEndsAt: instant,
    accessEndsAt: instant,
    retentionEndsAt: instant,
    reason: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().max(4000).optional(),
    ),
  })
  .superRefine((value, context) => {
    if (value.serviceEndsAt > value.accessEndsAt) {
      context.addIssue({
        code: "custom",
        path: ["accessEndsAt"],
        message: "Access cannot end before the service end",
      });
    }
    if (value.accessEndsAt >= value.retentionEndsAt) {
      context.addIssue({
        code: "custom",
        path: ["retentionEndsAt"],
        message: "Retention must end after access",
      });
    }
  });

export const beginBrandOffboardingSchema = z.object({
  planId: identifier,
  confirmSlug: z.string().trim().min(1).max(80),
});

export const cancelBrandOffboardingSchema = beginBrandOffboardingSchema;

import { BrandRole, DomainPurpose } from "@prisma/client";
import { z } from "zod";
import { normalizeHostname } from "@/lib/brands/hostname";
import { normalizeEmail } from "@/lib/email/normalize";

const optionalText = (maximum: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(maximum).optional(),
  );

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().url().max(2048).optional(),
);

const brandId = z.string().trim().min(1).max(64);
const color = z.string().trim().regex(/^#[0-9a-f]{6}$/i, "Use a six-digit hex color");
const hostname = z
  .string()
  .transform((value) => normalizeHostname(value))
  .refine((value): value is string => Boolean(value), "Enter a hostname without a path or email address");

export const createBrandOnboardingSchema = z.object({
  name: z.string().trim().min(1).max(200),
  legalName: optionalText(240),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens"),
  appHostname: hostname,
  ownerName: optionalText(200),
  ownerEmail: z.string().trim().email().max(320).transform(normalizeEmail),
  logoUrl: optionalUrl,
  supportEmail: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().email().max(320).transform(normalizeEmail).optional(),
  ),
  primaryColor: color.default("#17324d"),
  accentColor: color.default("#d79b3b"),
  backgroundColor: color.default("#f7f8fa"),
  foregroundColor: color.default("#17202a"),
});

export const addBrandDomainSchema = z.object({
  brandId,
  hostname,
  purpose: z.enum(DomainPurpose).default(DomainPurpose.APP),
});

export const updateBrandThemeSchema = z.object({
  brandId,
  logoUrl: optionalUrl,
  supportEmail: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().email().max(320).transform(normalizeEmail).optional(),
  ),
  primaryColor: color,
  accentColor: color,
  backgroundColor: color,
  foregroundColor: color,
});

export const inviteBrandMemberSchema = z.object({
  brandId,
  name: optionalText(200),
  email: z.string().trim().email().max(320).transform(normalizeEmail),
  role: z.enum(BrandRole),
});

export type CreateBrandOnboardingInput = z.input<typeof createBrandOnboardingSchema>;
export type AddBrandDomainInput = z.input<typeof addBrandDomainSchema>;
export type UpdateBrandThemeInput = z.input<typeof updateBrandThemeSchema>;
export type InviteBrandMemberInput = z.input<typeof inviteBrandMemberSchema>;

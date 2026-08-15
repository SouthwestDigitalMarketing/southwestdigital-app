import { AttributionTouchType, ContactStatus, LeadStatus, MarketingConsentStatus } from "@prisma/client";
import { z } from "zod";
import { normalizeEmail } from "@/lib/email/normalize";

const optionalText = (maximum: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(maximum).optional(),
  );

const optionalEmail = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().email().max(320).transform(normalizeEmail).optional(),
);

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().url().max(2048).optional(),
);

export const createContactSchema = z.object({
  displayName: z.string().trim().min(1).max(200),
  firstName: optionalText(100),
  lastName: optionalText(100),
  email: optionalEmail,
  secondaryEmail: optionalEmail,
  businessEmail: optionalEmail,
  personalEmail: optionalEmail,
  phoneE164: optionalText(32),
  phoneNumber: optionalText(64),
  roleTitle: optionalText(160),
  status: z.enum(ContactStatus).default(ContactStatus.ACTIVE),
  marketingConsent: z.enum(MarketingConsentStatus).default(MarketingConsentStatus.UNKNOWN),
  marketingConsentAt: z.coerce.date().optional(),
  marketingConsentSource: optionalText(160),
});

export const leadAttributionSchema = z.object({
  touchType: z.enum(AttributionTouchType).default(AttributionTouchType.FIRST_TOUCH),
  source: optionalText(200),
  medium: optionalText(200),
  campaign: optionalText(300),
  term: optionalText(300),
  content: optionalText(300),
  landingPageUrl: optionalUrl,
  referrerUrl: optionalUrl,
  gclid: optionalText(500),
  gbraid: optionalText(500),
  wbraid: optionalText(500),
  fbclid: optionalText(500),
  msclkid: optionalText(500),
  metaCampaignId: optionalText(200),
  metaAdSetId: optionalText(200),
  metaAdId: optionalText(200),
  capturedAt: z.coerce.date().optional(),
});

export const createLeadSchema = z.object({
  name: z.string().trim().min(1).max(200),
  company: optionalText(200),
  email: optionalEmail,
  phoneE164: optionalText(32),
  status: z.enum(LeadStatus).default(LeadStatus.NEW),
  source: optionalText(200),
  sourceDetail: optionalText(300),
  expectedServices: optionalText(2000),
  notes: optionalText(10000),
  estimatedValue: z.coerce.number().nonnegative().max(999999999999).optional(),
  valueCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
  attribution: leadAttributionSchema.optional(),
});

export type CreateContactInput = z.input<typeof createContactSchema>;
export type CreateLeadInput = z.input<typeof createLeadSchema>;


import { EmailConnectionProvider } from "@prisma/client";

export type ProviderStatus = "available" | "coming-soon";

export type ProviderInfo = {
  provider: EmailConnectionProvider;
  label: string;
  status: ProviderStatus;
  tagline: string;
  helpText: string;
};

export const PROVIDER_INFO: Record<EmailConnectionProvider, ProviderInfo> = {
  ZOHO: {
    provider: "ZOHO",
    label: "Zoho Mail",
    status: "available",
    tagline: "Send from your Zoho mailbox with a single sign-in.",
    helpText: "Emails you send in the app land in your Zoho Sent folder and thread with client replies.",
  },
  GMAIL: {
    provider: "GMAIL",
    label: "Gmail",
    status: "coming-soon",
    tagline: "One-click Gmail connection.",
    helpText: "Google requires an extra verification step; we'll enable this once verification is complete.",
  },
  MICROSOFT: {
    provider: "MICROSOFT",
    label: "Outlook / Microsoft 365",
    status: "coming-soon",
    tagline: "One-click Outlook or Microsoft 365 connection.",
    helpText: "Microsoft OAuth is queued to enable next. Bookmark this spot.",
  },
  SMTP: {
    provider: "SMTP",
    label: "Other (SMTP)",
    status: "coming-soon",
    tagline: "For any other provider via SMTP + app password.",
    helpText: "Fallback for Fastmail, ProtonMail Bridge, cPanel, and self-hosted mail. Coming after the OAuth providers.",
  },
};

export const PROVIDER_ORDER: EmailConnectionProvider[] = ["ZOHO", "GMAIL", "MICROSOFT", "SMTP"];

export function isProviderAvailable(provider: EmailConnectionProvider) {
  return PROVIDER_INFO[provider].status === "available";
}

// Zoho operates region-isolated data centers with distinct OAuth and Mail
// API endpoints. The user picks their region at connect time; if unsure
// they can check the URL of accounts.zoho.* they normally log into.
export type ZohoRegionKey = "US" | "EU" | "IN" | "AU";

export type ZohoRegionConfig = {
  key: ZohoRegionKey;
  label: string;
  accountsHost: string;
  mailApiHost: string;
};

export const ZOHO_REGIONS: Record<ZohoRegionKey, ZohoRegionConfig> = {
  US: { key: "US", label: "United States (zoho.com)", accountsHost: "accounts.zoho.com", mailApiHost: "mail.zoho.com" },
  EU: { key: "EU", label: "Europe (zoho.eu)", accountsHost: "accounts.zoho.eu", mailApiHost: "mail.zoho.eu" },
  IN: { key: "IN", label: "India (zoho.in)", accountsHost: "accounts.zoho.in", mailApiHost: "mail.zoho.in" },
  AU: { key: "AU", label: "Australia (zoho.com.au)", accountsHost: "accounts.zoho.com.au", mailApiHost: "mail.zoho.com.au" },
};

export const ZOHO_REGION_ORDER: ZohoRegionKey[] = ["US", "EU", "IN", "AU"];

export const DEFAULT_ZOHO_REGION: ZohoRegionKey = "US";

export function parseZohoRegion(value: unknown): ZohoRegionKey | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase() as ZohoRegionKey;
  return ZOHO_REGIONS[upper] ? upper : null;
}

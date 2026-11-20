// Ad campaigns shown on /ads, from drafts saved with Create ad (AdCampaign
// rows). Nothing here is live or spends money.

export type AdStatus = "draft" | "running" | "paused" | "ended";

export type AdPin = {
  label: string;
  latitude: number;
  longitude: number;
  radiusMiles: number;
};

export type AdCampaign = {
  id: string;
  name: string;
  status: AdStatus;
  platform: string;
  area: string;
  pins: AdPin[];
  offer: string;
  landingPage: string;
  landingPageLive: boolean;
  dailyBudgetUsd: number | null;
  headline?: string;
  primaryText?: string;
  callToAction?: string;
};

export type AdCampaignRow = {
  id: string;
  name: string;
  status: string;
  area: string;
  pins: unknown;
  offer: string;
  landingPage: string;
  headline: string;
  primaryText: string;
  callToAction: string;
  dailyBudgetCents: number | null;
};

const STATUSES: AdStatus[] = ["draft", "running", "paused", "ended"];

function isPin(value: unknown): value is AdPin {
  if (!value || typeof value !== "object") return false;
  const pin = value as Record<string, unknown>;
  return typeof pin.label === "string" && typeof pin.latitude === "number" &&
    typeof pin.longitude === "number" && typeof pin.radiusMiles === "number";
}

export function campaignFromRow(row: AdCampaignRow): AdCampaign {
  return {
    id: row.id,
    name: row.name,
    status: STATUSES.includes(row.status as AdStatus) ? (row.status as AdStatus) : "draft",
    platform: "Facebook and Instagram",
    area: row.area,
    pins: Array.isArray(row.pins) ? row.pins.filter(isPin) : [],
    offer: row.offer,
    landingPage: row.landingPage,
    landingPageLive: false,
    dailyBudgetUsd: row.dailyBudgetCents === null ? null : row.dailyBudgetCents / 100,
    headline: row.headline,
    primaryText: row.primaryText,
    callToAction: row.callToAction,
  };
}

// Shown on /ads until the Meta connection exists; each is Tom's call or setup.
export const BEFORE_GO_LIVE = [
  "Approve the landing page copy",
  "Build the landing page with the lead form into pipe",
  "Add the Meta pixel to the website",
  "Confirm the ad account in Meta Business Suite",
  "Set the daily budget",
  "Approve the ad, then it goes live",
];

export function mapLink(pin: AdPin): string {
  return `https://www.openstreetmap.org/?mlat=${pin.latitude}&mlon=${pin.longitude}#map=14/${pin.latitude}/${pin.longitude}`;
}

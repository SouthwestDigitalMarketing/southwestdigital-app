// Ad campaigns shown on /ads. Kept in code until a Meta (and later Google)
// Ads connection replaces it; nothing here is live or spends money.

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
  nextSteps: string[];
};

const CAMPAIGNS_BY_BRAND: Record<string, AdCampaign[]> = {
  "bookkeeping-conroe": [
    {
      id: "bentwater",
      name: "Bentwater",
      status: "draft",
      platform: "Facebook and Instagram",
      area: "Bentwater, Montgomery TX (Lake Conroe)",
      // Meta's smallest pin radius is 1 mile; two pins cover the neighborhood
      // (OpenStreetMap outline 30.410–30.437 N, 95.609–95.657 W).
      pins: [
        { label: "Bentwater west", latitude: 30.424, longitude: -95.643, radiusMiles: 1 },
        { label: "Bentwater east", latitude: 30.424, longitude: -95.62, radiusMiles: 1 },
      ],
      offer: "Let us take the bookkeeping off your plate: free books review call",
      landingPage: "https://bookkeepingconroe.com/off-your-plate",
      landingPageLive: false,
      dailyBudgetUsd: null,
      nextSteps: [
        "Tom approves the funnel page copy",
        "Build the funnel page with the lead form into pipe",
        "Add the Meta pixel to bookkeepingconroe.com",
        "Confirm the ad account in Meta Business Suite",
        "Tom sets the daily budget",
        "Tom approves the ads, then they go live",
      ],
    },
  ],
};

export function campaignsForBrand(slug: string): AdCampaign[] {
  return CAMPAIGNS_BY_BRAND[slug] ?? [];
}

export function mapLink(pin: AdPin): string {
  return `https://www.openstreetmap.org/?mlat=${pin.latitude}&mlon=${pin.longitude}#map=14/${pin.latitude}/${pin.longitude}`;
}

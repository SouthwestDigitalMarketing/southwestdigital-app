// Areas, buttons and validation for the Create ad form. Pure, so the
// server action and tests share it.

import type { AdPin } from "./campaigns";

export type AdArea = { id: string; label: string; pins: AdPin[] };

// Meta's smallest pin radius is 1 mile, so a neighborhood is one or more pins.
export const AD_AREAS: AdArea[] = [
  {
    id: "bentwater",
    label: "Bentwater, Montgomery TX (Lake Conroe)",
    // OpenStreetMap outline 30.410–30.437 N, 95.609–95.657 W.
    pins: [
      { label: "Bentwater west", latitude: 30.424, longitude: -95.643, radiusMiles: 1 },
      { label: "Bentwater east", latitude: 30.424, longitude: -95.62, radiusMiles: 1 },
    ],
  },
];

export const CALL_TO_ACTIONS = ["Learn more", "Book now", "Contact us", "Call now", "Get quote"] as const;

export const DEFAULT_DRAFT = {
  offer: "Let us take the bookkeeping off your plate: free books review call",
  landingPage: "https://bookkeepingconroe.com/off-your-plate",
  headline: "Let us take the bookkeeping off your plate",
  primaryText:
    "QuickBooks behind? Office manager buried? Done doing the books yourself? We're local bookkeepers right here by Lake Conroe. We catch you up, then keep you current every month. Book a free books review.",
  callToAction: "Book now",
};

export type AdDraftInput = {
  name: string;
  area: string;
  pins: AdPin[];
  offer: string;
  landingPage: string;
  headline: string;
  primaryText: string;
  callToAction: string;
  dailyBudgetCents: number | null;
};

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function parseAdDraft(form: FormData): AdDraftInput {
  const area = AD_AREAS.find((candidate) => candidate.id === text(form, "areaId"));
  if (!area) throw new Error("Choose an area.");

  const name = text(form, "name") || area.label.split(",")[0];
  const offer = text(form, "offer");
  const headline = text(form, "headline");
  const primaryText = text(form, "primaryText");
  const callToAction = text(form, "callToAction");
  const landingPage = text(form, "landingPage");

  if (!headline) throw new Error("Write a headline.");
  if (headline.length > 80) throw new Error("Keep the headline under 80 characters.");
  if (!primaryText) throw new Error("Write the ad text.");
  if (primaryText.length > 1000) throw new Error("Keep the ad text under 1,000 characters.");
  if (!(CALL_TO_ACTIONS as readonly string[]).includes(callToAction)) throw new Error("Choose a button.");
  if (!/^https:\/\/\S+$/.test(landingPage)) throw new Error("The landing page must be an https:// link.");

  const budgetRaw = text(form, "dailyBudget").replace(/^\$/, "");
  let dailyBudgetCents: number | null = null;
  if (budgetRaw) {
    const dollars = Number(budgetRaw);
    if (!Number.isFinite(dollars) || dollars <= 0 || dollars > 500) {
      throw new Error("Daily budget must be between $1 and $500, or left blank.");
    }
    dailyBudgetCents = Math.round(dollars * 100);
  }

  return {
    name,
    area: area.label,
    pins: area.pins,
    offer: offer || DEFAULT_DRAFT.offer,
    landingPage,
    headline,
    primaryText,
    callToAction,
    dailyBudgetCents,
  };
}

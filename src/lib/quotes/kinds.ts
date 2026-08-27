export const OFFER_KINDS = [
  {
    key: "bookkeeping",
    name: "Bookkeeping services",
    summary: "Price monthly bookkeeping, cleanup, and add-ons for a client.",
    href: "/offers/new",
  },
  {
    key: "referral-network",
    name: "Referral network",
    summary: "Build the partner / bookkeeper referral-network offer.",
    href: "/offers/referral",
  },
] as const;

export type OfferKindKey = (typeof OFFER_KINDS)[number]["key"];

export function isOfferKindKey(value: string): value is OfferKindKey {
  return OFFER_KINDS.some((kind) => kind.key === value);
}

export function parseContactIds(raw: string | string[] | undefined): string[] {
  const values = Array.isArray(raw) ? raw : raw ? raw.split(",") : [];
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function whoHref(kind: OfferKindKey, contactId?: string) {
  const params = new URLSearchParams({ kind });
  if (contactId) params.set("contact", contactId);
  return `/offers/who?${params.toString()}`;
}

export function builderHref(kind: OfferKindKey, contactIds: string[], offerId?: string) {
  const match = OFFER_KINDS.find((item) => item.key === kind);
  const href = match?.href ?? "/offers/new";
  const params = new URLSearchParams();
  if (contactIds.length) params.set("contacts", contactIds.join(","));
  if (offerId) params.set("offer", offerId);
  const qs = params.toString();
  return qs ? `${href}?${qs}` : href;
}

export function offerHref(href: string, contactId?: string) {
  if (!contactId) return href;
  return `${href}${href.includes("?") ? "&" : "?"}contact=${contactId}`;
}

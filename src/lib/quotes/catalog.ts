export const REAL_ESTATE_TAG_KEY = "real-estate";

export function tagMarksRealEstate(tag: { key: string; label?: string | null }) {
  const key = tag.key.trim().toLowerCase();
  const label = (tag.label ?? "").trim().toLowerCase();
  return key === REAL_ESTATE_TAG_KEY || key.includes("real-estate") || label === "real estate";
}

export type CatalogRealEstateMarker = {
  id: string;
  name: string;
  code: string | null;
  realEstateSpecific: boolean;
};

const FALLBACK_REAL_ESTATE_EXTRA_IDS = new Set([
  "property-reporting-setup",
  "real-estate-chart-of-accounts",
  "new-quickbooks-file",
]);

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function extraIsRealEstateSpecific(
  extra: { id: string; name: string; realEstateSpecific?: boolean },
  catalog: CatalogRealEstateMarker[],
) {
  const extraName = normalize(extra.name);
  const match = catalog.find(
    (item) =>
      item.id === extra.id ||
      (item.code != null && normalize(item.code) === extra.id) ||
      normalize(item.name) === extraName,
  );
  if (match) return match.realEstateSpecific;
  if (typeof extra.realEstateSpecific === "boolean") return extra.realEstateSpecific;
  return FALLBACK_REAL_ESTATE_EXTRA_IDS.has(extra.id);
}

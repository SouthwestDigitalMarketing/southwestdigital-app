export const REAL_ESTATE_TAG_KEY = "real-estate";

export function tagMarksRealEstate(tag: { key: string; label?: string | null }) {
  const key = tag.key.trim().toLowerCase();
  const label = (tag.label ?? "").trim().toLowerCase();
  return (
    key === REAL_ESTATE_TAG_KEY ||
    key.includes("real-estate") ||
    label === "real estate" ||
    label === "real estate service"
  );
}

export type CatalogRealEstateMarker = {
  id: string;
  name: string;
  code: string | null;
  realEstateSpecific: boolean;
};

export type ProposalOptionCatalogItem = CatalogRealEstateMarker & {
  offerKey: string;
  description: string;
  defaultInclusion: "optional" | "included";
  defaultPrice: number;
  billingCadence: string;
  requiresPlatformMigration: boolean;
  requiredTargetPlatform: string | null;
  applicabilityNote: string | null;
};

export type ProposalApplicabilityContext = {
  bookSetType: string;
  ongoingBookkeepingPlatform: string;
  platformMigrationEnabled: boolean;
};

export function proposalCatalogItemApplicability(
  item: ProposalOptionCatalogItem,
  context: ProposalApplicabilityContext,
) {
  if (item.realEstateSpecific && context.bookSetType === "other-business") {
    return { applicable: false, reason: "Only available for real-estate book sets." };
  }
  if (item.requiresPlatformMigration && !context.platformMigrationEnabled) {
    return { applicable: false, reason: "Requires a platform migration in this offer." };
  }
  if (
    item.requiredTargetPlatform &&
    item.requiredTargetPlatform !== context.ongoingBookkeepingPlatform
  ) {
    const platform = item.requiredTargetPlatform === "qbo" ? "QuickBooks" : "Stessa";
    return { applicable: false, reason: `Requires ${platform} as the ongoing platform.` };
  }

  return {
    applicable: true,
    reason:
      item.applicabilityNote ??
      (item.realEstateSpecific ? "Available because this offer includes real-estate books." : "Available for this offer."),
  };
}

const FALLBACK_REAL_ESTATE_EXTRA_IDS = new Set([
  "stessa-migration",
  "property-reporting-setup",
  "real-estate-chart-of-accounts",
  "new-quickbooks-file",
  "per-property-class-tracking",
]);

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function extraIsRealEstateSpecific(
  extra: { id: string; name: string; realEstateSpecific?: boolean },
  catalog: CatalogRealEstateMarker[],
) {
  if (typeof extra.realEstateSpecific === "boolean") return extra.realEstateSpecific;
  const extraName = normalize(extra.name);
  const match = catalog.find(
    (item) =>
      item.id === extra.id ||
      (item.code != null && normalize(item.code) === extra.id) ||
      normalize(item.name) === extraName,
  );
  if (match) return match.realEstateSpecific;
  return FALLBACK_REAL_ESTATE_EXTRA_IDS.has(extra.id);
}

export function extraIsAvailableForBookSet(
  extra: { id: string; name: string; realEstateSpecific?: boolean },
  catalog: CatalogRealEstateMarker[],
  bookSetType: string,
) {
  return bookSetType !== "other-business" || !extraIsRealEstateSpecific(extra, catalog);
}

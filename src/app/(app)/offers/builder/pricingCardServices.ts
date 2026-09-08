type CardService = {
  id: string;
  serviceName: string;
  price: number;
  includedPlacement?: "main" | "included";
};

type CardOption<T extends CardService> = {
  name: string;
  recurringRows: T[];
  oneTimeRows: T[];
};

// Placement changes presentation only. The original rows retain their billing cadence.
export function pricingCardServices<T extends CardService>(
  option: CardOption<T>,
  lowerTier?: CardOption<T>,
) {
  const mainRecurring = (tier: CardOption<T>) =>
    tier.recurringRows.filter((row) => row.includedPlacement !== "included");
  const bannerRows = (tier: CardOption<T>) => [
    ...tier.oneTimeRows.filter((row) =>
      row.price === 0 && row.serviceName !== "Onboarding" && row.includedPlacement !== "main",
    ),
    ...tier.recurringRows.filter((row) => row.includedPlacement === "included"),
  ];
  const recurring = mainRecurring(option);
  const lowerTierName = lowerTier?.name ?? null;
  const lowerRecurring = new Set(lowerTier ? mainRecurring(lowerTier).map((row) => row.serviceName) : []);
  const recurringLeadInName = lowerTierName && [...lowerRecurring].every(
    (name) => recurring.some((row) => row.serviceName === name),
  ) ? lowerTierName : null;
  const isNew = (name: string) => Boolean(lowerTier) && !lowerRecurring.has(name);
  const bkRow = recurring.find((row) =>
    row.id.endsWith("-bonus-monthly-bookkeeping")
    || row.serviceName === "Monthly QuickBooks Bookkeeping"
    || row.serviceName === "Monthly Bookkeeping",
  );
  const supportRow = recurring.find((row) => row.serviceName.endsWith("Client Support"));
  const otherRecurring = recurring.filter((row) => row !== bkRow && !row.serviceName.endsWith("Client Support"));
  const orderedRecurring = recurringLeadInName
    ? otherRecurring.filter((row) => isNew(row.serviceName))
    : otherRecurring;
  const zeroPriceRows = bannerRows(option);
  const lowerZero = new Set(lowerTier ? [
    ...lowerTier.oneTimeRows.filter((row) => row.price === 0 && row.includedPlacement !== "main"),
    ...lowerTier.recurringRows.filter((row) => row.includedPlacement === "included"),
  ].map((row) => row.serviceName) : []);
  const inheritsIncluded = lowerTierName && [...lowerZero].every(
    (name) => zeroPriceRows.some((row) => row.serviceName === name),
  );
  const incrementalBonuses = inheritsIncluded
    ? zeroPriceRows.filter((row) => !lowerZero.has(row.serviceName))
    : [...(bkRow && !bkRow.includedPlacement ? [bkRow] : []), ...zeroPriceRows];
  // Keep historical automatic highlights, but never promote an explicitly main-list service.
  const fallback = orderedRecurring.find((row) => !row.includedPlacement)
    ?? (supportRow && !supportRow.includedPlacement ? supportRow : undefined)
    ?? (bkRow && !bkRow.includedPlacement ? bkRow : undefined)
    ?? recurring.find((row) => !row.includedPlacement);
  const displayedBonuses = incrementalBonuses.length > 0
    ? incrementalBonuses
    : fallback ? [fallback] : [];
  const hasInheritedBonuses = Boolean(inheritsIncluded) && lowerZero.size > 0;
  const mainOneTime = option.oneTimeRows.filter((row) =>
    row.price === 0 && row.serviceName !== "Onboarding" && row.includedPlacement === "main",
  );
  return {
    lowerTierName, recurringLeadInName, isNew, bkRow, supportRow,
    orderedRecurring, inheritsIncluded, hasInheritedBonuses, displayedBonuses, mainOneTime,
  };
}

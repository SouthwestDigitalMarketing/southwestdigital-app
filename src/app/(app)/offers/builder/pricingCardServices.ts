type CardService = {
  id: string;
  serviceName: string;
  price: number;
  cleanupPeriodKey?: string;
};

type CardOption<T extends CardService> = {
  name: string;
  recurringRows: T[];
  oneTimeRows: T[];
};

// All inclusions share one list, regardless of old saved placement preferences.
// The original rows still determine billing and checkout.
export function pricingCardServices<T extends CardService>(
  option: CardOption<T>,
  lowerTier?: CardOption<T>,
) {
  const included = (tier: CardOption<T>) => [
    ...tier.recurringRows,
    ...tier.oneTimeRows.filter((row) =>
      row.price === 0 && row.serviceName !== "Onboarding" && !row.cleanupPeriodKey,
    ),
  ];
  const serviceKey = (row: T) => row.id.replace(/^(maintain|improve|grow)-bonus-/, "");
  const lowerServices = new Set(lowerTier ? included(lowerTier).map(serviceKey) : []);
  const includedRows = included(option).filter((row) => !lowerServices.has(serviceKey(row)));
  return { lowerTierName: lowerTier?.name ?? null, includedRows };
}

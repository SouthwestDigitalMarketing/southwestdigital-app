export const DISCOUNT_KINDS = [
  {
    id: "bonus",
    label: "Bonus or extra included",
    hint: "A named extra they only get if they start in time.",
  },
  {
    id: "percent-off",
    label: "Percentage discount",
    hint: "A percent off if they start in time.",
  },
  {
    id: "amount-off",
    label: "Dollar discount",
    hint: "A dollar amount off if they start in time.",
  },
  {
    id: "onboarding-waiver",
    label: "Waive onboarding fee",
    hint: "The onboarding fee is waived if they start in time.",
  },
  {
    id: "custom",
    label: "Custom offer",
    hint: "Write the benefit in your own words.",
  },
] as const;

export type DiscountKind = (typeof DISCOUNT_KINDS)[number]["id"];

export const DISCOUNT_ACTIVATION_MODES = [
  {
    id: "held",
    label: "Hold until you turn it on",
    hint: "Saved, but not shown on the proposal until you choose to show it.",
  },
  {
    id: "immediate",
    label: "Show when they first open the proposal",
    hint: "The lead sees this the first time they click the proposal link.",
  },
] as const;

export type DiscountActivationMode = (typeof DISCOUNT_ACTIVATION_MODES)[number]["id"];

export const DISCOUNT_DEADLINE_MODES = [
  { id: "relative", label: "A number of days after it appears" },
  { id: "date", label: "A specific calendar date" },
] as const;

export type DiscountDeadlineMode = (typeof DISCOUNT_DEADLINE_MODES)[number]["id"];

export function isDiscountKind(value: string): value is DiscountKind {
  return DISCOUNT_KINDS.some((kind) => kind.id === value);
}

export function isDiscountDeadlineMode(value: string): value is DiscountDeadlineMode {
  return DISCOUNT_DEADLINE_MODES.some((mode) => mode.id === value);
}

export function isDiscountActivationMode(value: string): value is DiscountActivationMode {
  return DISCOUNT_ACTIVATION_MODES.some((mode) => mode.id === value);
}

export function parseDiscountActivationMode(value: string): DiscountActivationMode {
  return value === "immediate" ? "immediate" : "held";
}

export function isDiscountShownOnOpen(activationMode: string) {
  return activationMode === "immediate";
}

export function discountKindLabel(kind: string) {
  return DISCOUNT_KINDS.find((item) => item.id === kind)?.label ?? kind;
}

export function formatDiscountSchedule(discount: {
  activationMode: string;
  deadlineMode: string;
  durationDays: number;
  deadlineDate: string | null;
}) {
  const appears = isDiscountShownOnOpen(discount.activationMode)
    ? "Shown when they first open the proposal"
    : "Held — not shown until you turn it on";
  const validity =
    discount.deadlineMode === "date" && discount.deadlineDate
      ? `valid until ${discount.deadlineDate}`
      : `once shown, valid for ${discount.durationDays} days`;
  return `${appears}; ${validity}`;
}

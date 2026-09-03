export type UrgencyDeadlineMode = "relative" | "date";

export type UrgencyKind =
  | "percent-off"
  | "amount-off"
  | "bonus"
  | "onboarding-waiver"
  | "custom";

export type UrgencyOfferConfig = {
  enabled: boolean;
  deadlineMode: UrgencyDeadlineMode;
  durationDays: number;
  deadlineDate: string;
  kind: UrgencyKind;
  percent: number;
  amount: number;
  title: string;
  details: string;
};

export const DEFAULT_URGENCY_OFFER: UrgencyOfferConfig = {
  enabled: false,
  deadlineMode: "relative",
  durationDays: 14,
  deadlineDate: "",
  kind: "bonus",
  percent: 10,
  amount: 250,
  title: "",
  details: "",
};

export const URGENCY_KIND_OPTIONS: Array<{ id: UrgencyKind; label: string; hint: string }> = [
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
];

export type UrgencyOfferDisplay = {
  active: boolean;
  expired: boolean;
  expiresAt: Date | null;
  dateLabel: string;
  remainingLabel: string;
  headline: string;
  details: string;
  ctaHint: string;
  kind: UrgencyKind | null;
};

function isKind(value: unknown): value is UrgencyKind {
  return (
    value === "percent-off" ||
    value === "amount-off" ||
    value === "bonus" ||
    value === "onboarding-waiver" ||
    value === "custom"
  );
}

export function normalizeUrgencyOffer(value: unknown): UrgencyOfferConfig {
  if (!value || typeof value !== "object") return DEFAULT_URGENCY_OFFER;
  const record = value as Record<string, unknown>;
  const durationDays = Number(record.durationDays);
  const percent = Number(record.percent);
  const amount = Number(record.amount);
  return {
    enabled: record.enabled === true,
    deadlineMode: record.deadlineMode === "date" ? "date" : "relative",
    durationDays:
      Number.isFinite(durationDays) && durationDays > 0
        ? Math.min(365, Math.round(durationDays))
        : DEFAULT_URGENCY_OFFER.durationDays,
    deadlineDate: typeof record.deadlineDate === "string" ? record.deadlineDate : "",
    kind: isKind(record.kind) ? record.kind : DEFAULT_URGENCY_OFFER.kind,
    percent:
      Number.isFinite(percent) && percent > 0
        ? Math.min(100, Math.round(percent))
        : DEFAULT_URGENCY_OFFER.percent,
    amount:
      Number.isFinite(amount) && amount > 0
        ? Math.round(amount)
        : DEFAULT_URGENCY_OFFER.amount,
    title: typeof record.title === "string" ? record.title : "",
    details: typeof record.details === "string" ? record.details : "",
  };
}

function endOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);
}

export function getUrgencyExpiresAt(
  config: UrgencyOfferConfig,
  now = new Date(),
  issuedAt?: Date | string | null,
) {
  if (!config.enabled) return null;
  if (config.deadlineMode === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(config.deadlineDate)) return null;
    const [year, month, day] = config.deadlineDate.split("-").map(Number);
    return endOfLocalDay(new Date(year, month - 1, day));
  }
  const start = issuedAt ? new Date(issuedAt) : now;
  if (Number.isNaN(start.getTime())) return null;
  const expires = new Date(start.getFullYear(), start.getMonth(), start.getDate() + config.durationDays);
  return endOfLocalDay(expires);
}

function formatDateLabel(value: Date) {
  return value.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function remainingLabel(daysLeft: number) {
  if (daysLeft <= 0) return "Expires today";
  if (daysLeft === 1) return "1 day left";
  return `${daysLeft} days left`;
}

function defaultHeadline(config: UrgencyOfferConfig, dateLabel: string) {
  switch (config.kind) {
    case "percent-off":
      return `Save ${config.percent}% if you get started by ${dateLabel}`;
    case "amount-off":
      return `${formatMoney(config.amount)} off if you get started by ${dateLabel}`;
    case "onboarding-waiver":
      return `Onboarding fee waived if you get started by ${dateLabel}`;
    case "bonus":
    case "custom":
      return config.title.trim() || `Limited-time offer if you get started by ${dateLabel}`;
  }
}

function defaultDetails(config: UrgencyOfferConfig) {
  const written = config.details.trim();
  if (written) return written;
  switch (config.kind) {
    case "percent-off":
      return `This ${config.percent}% savings is only available if you accept this proposal by the date above.`;
    case "amount-off":
      return `This ${formatMoney(config.amount)} reduction is only available if you accept this proposal by the date above.`;
    case "onboarding-waiver":
      return "Start by the date above and we will waive the onboarding fee on this proposal.";
    case "bonus":
      return "This extra is included only if you accept this proposal by the date above.";
    case "custom":
      return "This limited-time offer applies only if you accept this proposal by the date above.";
  }
}

export function getUrgencyOfferDisplay(
  config: UrgencyOfferConfig,
  now = new Date(),
  issuedAt?: Date | string | null,
): UrgencyOfferDisplay {
  const inactive: UrgencyOfferDisplay = {
    active: false,
    expired: false,
    expiresAt: null,
    dateLabel: "",
    remainingLabel: "",
    headline: "",
    details: "",
    ctaHint: "",
    kind: null,
  };
  if (!config.enabled) return inactive;

  const expiresAt = getUrgencyExpiresAt(config, now, issuedAt);
  if (!expiresAt) return inactive;

  const dateLabel = formatDateLabel(expiresAt);
  const daysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000));
  const expired = now.getTime() > expiresAt.getTime();
  const headline = defaultHeadline(config, dateLabel);
  const details = defaultDetails(config);

  return {
    active: !expired,
    expired,
    expiresAt,
    dateLabel,
    remainingLabel: remainingLabel(daysLeft),
    headline,
    details,
    ctaHint: `Includes this limited-time offer if you start by ${dateLabel}`,
    kind: config.kind,
  };
}

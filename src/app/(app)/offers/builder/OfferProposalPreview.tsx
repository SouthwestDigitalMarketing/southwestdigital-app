"use client";

import { pricingCardServices } from "./pricingCardServices";
import ProposalPaymentPlan from "./ProposalPaymentPlan";
import { proposalPaymentSchedule } from "@/lib/quotes/paymentSchedule";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  LineChart,
  Pencil,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { Modal } from "@/components/Modal";
import { useBrand } from "@/lib/brands/context";
import { readableForegroundColor } from "@/lib/brands/colors";
import { overlaySurfaceCssVariables, primaryActionCssVariables } from "@/lib/brands/themeTokens";
import {
  getProposalAccentHeaderBackground,
  getProposalDarkSurfaceColors,
  getProposalInkColor,
  getProposalSectionHeaderBackground,
  getProposalSurfaceTextColor,
  getProposalTheme,
  DEFAULT_PROPOSAL_THEME_ID,
  DEFAULT_PROPOSAL_MODE,
  type ProposalMode,
} from "./proposalThemes";
import { ProposalReviewsSection } from "./ProposalReviewsSection";
import { SERVICE_LEVEL_COPY, serviceLevelTitle, splitServiceLevelMeaning } from "@/lib/quotes/serviceLevels";
import AgreementTextView from "./AgreementTextView";
import DepositPaymentForm from "./DepositPaymentForm";
import { waitForRecordedProposalPayment } from "@/lib/engagements/waitForRecordedProposalPayment";
import {
  formatPersonName,
  resolvePrimaryContact,
  useProposalContactInfoDemoState,
  type ContactInfoState,
} from "./ProposalContactInfoState";
import {
  getAnnualSavingsPercent,
  getListedOnboardingFee,
  getProposalAdditionalOptions,
  getProposalBonuses,
  getProposalPricingSnapshotData,
  getStandardOnboardingFee,
  hasCatchUpPricingInputs,
  useProposalAssessmentDemoState,
  bookkeepingPlatformLabel,
  type AssessmentState,
  type HistoricalCleanupPeriod,
} from "./ProposalCreationWorkspaceDemo";
import {
  DEFAULT_HERO_CONTINUE_BUTTON,
  DEFAULT_HERO_MEDIA_BUTTON,
  HeroCtaContent,
  normalizeHeroButton,
} from "./heroButtons";
import { resolveCoverMedia, resolveVideoPosterUrl } from "./coverMedia";
import { useProposalTracking } from "./useProposalTracking";
import { DEFAULT_URGENCY_OFFER, getUrgencyOfferDisplay } from "./urgencyOffer";
import { ProposalUrgencyBanner, ProposalUrgencyNote } from "./ProposalUrgencyBanner";
import {
  DEFAULT_AGREEMENT_TEMPLATE_NAME,
  DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE,
  renderAgreementTemplate,
} from "@/lib/agreements/template";
import type { AgreementTemplateOption } from "@/lib/agreements/types";
import {
  isProposalPreviewSimulation,
  resolveProposalInteractionEngagementId,
} from "@/lib/quotes/previewSafety";
import type { PublicBookkeepingProposal, PublicProposalPricing } from "@/lib/quotes/publicProposal";
import { resolveProposalPackageName } from "./proposalPackageNames";
import { includedServicePackages, proposalServiceAddOns, serviceIsApplicable } from "@/lib/quotes/proposalServices";

type CloudflareStreamEvent = "play" | "pause" | "ended";

export type ProposalPreviewEditTarget =
  | "contact"
  | "cover-content"
  | "cover-media"
  | "theme"
  | "pricing"
  | "services"
  | "agreement";

type CloudflareStreamPlayer = {
  play: () => Promise<void>;
  pause: () => void;
  muted: boolean;
  paused: boolean;
  addEventListener: (event: CloudflareStreamEvent, listener: () => void) => void;
  removeEventListener: (event: CloudflareStreamEvent, listener: () => void) => void;
};

type CloudflareStreamFactory = (iframe: HTMLIFrameElement) => CloudflareStreamPlayer;

declare global {
  interface Window {
    Stream?: CloudflareStreamFactory;
  }
}

// ─── Media helpers ─────────────────────────────────────────────────────────────

// Returns an iframe-embeddable URL for recognized video platforms, or null if not a valid video URL.
export function resolveVideoEmbedUrl(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    // YouTube
    if (u.hostname === "www.youtube.com" || u.hostname === "youtube.com") {
      if (u.pathname.startsWith("/embed/")) return url;
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1).split("?")[0];
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    // Vimeo
    if (u.hostname === "vimeo.com" || u.hostname === "www.vimeo.com") {
      const id = u.pathname.replace(/^\//, "").split("?")[0];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    if (u.hostname === "player.vimeo.com") return url;
    // Cloudflare Stream. Media settings may store a share URL ending in /watch,
    // but the embedded player and its JavaScript API require /iframe.
    if (u.hostname.endsWith(".cloudflarestream.com")) {
      if (u.pathname.endsWith("/watch")) {
        u.pathname = `${u.pathname.slice(0, -"/watch".length)}/iframe`;
      }
      return u.toString();
    }
    // Generic iframe embed (path ends with /iframe)
    if (u.pathname.endsWith("/iframe")) return url;
    return null;
  } catch {
    return null;
  }
}

function isCloudflareStreamEmbed(url: string): boolean {
  try {
    const videoUrl = new URL(url);
    return videoUrl.hostname.endsWith(".cloudflarestream.com") && videoUrl.pathname.endsWith("/iframe");
  } catch {
    return false;
  }
}

let cloudflareStreamSdk: Promise<CloudflareStreamFactory> | null = null;

function loadCloudflareStreamSdk(): Promise<CloudflareStreamFactory> {
  if (window.Stream) return Promise.resolve(window.Stream);
  if (cloudflareStreamSdk) return cloudflareStreamSdk;

  cloudflareStreamSdk = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://embed.cloudflarestream.com/embed/sdk.latest.js";
    script.async = true;
    script.onload = () => window.Stream ? resolve(window.Stream) : reject(new Error("Cloudflare Stream SDK did not load."));
    script.onerror = () => reject(new Error("Unable to load the Cloudflare Stream SDK."));
    document.head.appendChild(script);
  });

  return cloudflareStreamSdk;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type OptionId = "grow" | "improve" | "maintain";

type ServiceRow = {
  id: string;
  serviceName: string;
  billStart: string;
  billEnd: string;
  billEvery?: string;
  invoiceType: string;
  priceType: string;
  quantity: number;
  price: number;
  note?: string;
  cleanupPeriodKey?: string;
  platformTag?: "QBO" | "Stessa" | "Sage";
  required?: boolean;
};

type ProposalOption = {
  id: OptionId;
  name: string;
  monthlyPrice: number;
  recurringRows: ServiceRow[];
  oneTimeRows: ServiceRow[];
};

type CheckoutSummary = {
  tier: OptionId;
  tierLabel: string;
  hasTwelveMonthAgreement: boolean;
  selectedCleanupPeriodKeys: string[];
  selectedAdditionalOptionIds: string[];
  recurringMonthlyTotal: number;
  cleanupTotal: number;
  onboardingFee: number;
  oneTimeTotal: number;
  amountDueNow: number;
  chargeKind: string;
  creditApplied?: number;
  paymentScheduleVersion?: 2;
  cleanupMonths?: number;
  cleanupMonthlyRate?: number;
  additionalOneTimeTotal?: number;
  includedServices?: { name: string; description: string }[];
};

// ─── Static data ──────────────────────────────────────────────────────────────

type PreviewAssessment = PublicBookkeepingProposal["assessment"] & {
  isTestProposal?: boolean;
};
type PreviewContactInfo = PublicBookkeepingProposal["contactInfo"] | ContactInfoState;

function isOnboardingFeeWaived(assessment: {
  waiveOnboardingFee?: boolean;
  onboardingFeeOverride?: number | null;
}) {
  return assessment.waiveOnboardingFee === true || assessment.onboardingFeeOverride === 0;
}

function getOnboardingFee(assessment: {
  waiveOnboardingFee?: boolean;
  isTestProposal?: boolean;
  onboardingFeeOverride?: number | null;
}, cleanupMonths: number) {
  if (assessment.waiveOnboardingFee) return 0;
  if (assessment.isTestProposal) return 1;
  if (typeof assessment.onboardingFeeOverride === "number") return Math.max(0, assessment.onboardingFeeOverride);
  return getStandardOnboardingFee(cleanupMonths);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

// Mobile package colors (tabs, checkout-bar underline and Select button). Improve uses the
// brand's own dark color; Grow and Maintain are fixed gold and teal (Tom, 2026-11-10).
type TierColor = { background: string; foreground: string };
const GROW_TIER_COLOR = "#D4A017";
const MAINTAIN_TIER_COLOR = "#0F766E";

const optionMeta: Array<{ id: OptionId; icon: typeof Sparkles; accentClass: string; serviceLevel: string }> = [
  { id: "grow",     icon: Sparkles,    accentClass: "text-emerald-600", serviceLevel: "Concierge" },
  { id: "improve",  icon: LineChart,   accentClass: "text-indigo-600",  serviceLevel: "Priority"  },
  { id: "maintain", icon: ShieldCheck, accentClass: "text-amber-600",   serviceLevel: "Standard"  },
];

const baseOptions: Record<OptionId, ProposalOption> = {
  grow: {
    id: "grow",
    name: "Grow",
    monthlyPrice: 0,
    recurringRows: [],
    oneTimeRows: [],
  },
  improve: {
    id: "improve",
    name: "Improve",
    monthlyPrice: 0,
    recurringRows: [],
    oneTimeRows: [],
  },
  maintain: {
    id: "maintain",
    name: "Maintain",
    monthlyPrice: 0,
    recurringRows: [],
    oneTimeRows: [],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Package tabs: drive the swipeable package cards (one card in view at a time, every screen size).
function MobilePackageTabs({
  compact = false,
  className,
  options,
  activeId,
  discountMultiplier,
  tierColors,
  inkColor,
  onSelect,
}: {
  compact?: boolean;
  className: string;
  options: Record<OptionId, { name: string; monthlyPrice: number }>;
  activeId: OptionId;
  discountMultiplier: number;
  tierColors: Record<OptionId, TierColor>;
  inkColor: string;
  onSelect: (id: OptionId) => void;
}) {
  if (compact) {
    // Slim text row for the bottom bar: still tappable, deliberately quieter than the main tabs.
    return (
      <div role="tablist" aria-label="Packages" className={`grid grid-cols-3 ${className}`}>
        {optionMeta.map(({ id }) => {
          const active = activeId === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(id)}
              className={`min-h-10 border-b-2 py-2 text-sm transition ${active ? "font-bold" : "border-transparent font-medium text-slate-500"}`}
              style={active ? { borderColor: tierColors[id].background, color: inkColor } : undefined}
            >
              {options[id].name}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div role="tablist" aria-label="Packages" className={`grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1 ${className}`}>
      {optionMeta.map(({ id }) => {
        const option = options[id];
        const monthly = Math.round(option.monthlyPrice * discountMultiplier * 100) / 100;
        const active = activeId === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(id)}
            className={`rounded-xl px-2 py-2 text-center transition ${active ? "shadow-sm" : ""}`}
            style={active ? { backgroundColor: tierColors[id].background, color: tierColors[id].foreground } : { color: inkColor }}
          >
            <span className="flex items-center justify-center gap-1.5 text-sm font-bold">
              {/* Each package keeps its color even when not selected. */}
              {active ? null : <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tierColors[id].background }} />}
              {option.name}
            </span>
            <span className={`mt-0.5 block text-xs font-medium ${active ? "opacity-90" : "text-slate-500"}`}>{fmt(monthly)}/mo</span>
          </button>
        );
      })}
    </div>
  );
}

// Cover video with an instant still: the thumbnail paints on first render while the
// player iframe loads behind it, then fades out once the iframe has loaded.
function CoverVideoFrame({
  embedUrl,
  posterUrl,
  iframeRef,
}: {
  embedUrl: string;
  posterUrl: string | null;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}) {
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  let origin: string | null = null;
  try {
    origin = new URL(embedUrl).origin;
  } catch {
    origin = null;
  }
  return (
    <div className="relative aspect-video bg-slate-100">
      {origin ? <link rel="preconnect" href={origin} /> : null}
      <iframe
        ref={iframeRef}
        src={embedUrl}
        onLoad={() => setFrameLoaded(true)}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="h-full w-full"
      />
      {posterUrl && !posterFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={posterUrl}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          onError={() => setPosterFailed(true)}
          className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${frameLoaded ? "opacity-0" : "opacity-100"}`}
        />
      ) : null}
    </div>
  );
}

function fmt(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function proposalHeaders(token: string | null, includeJson = false): Record<string, string> {
  return {
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
    ...(token ? { "x-proposal-token": token } : {}),
  };
}

function sectionTotal(rows: ServiceRow[]) {
  return rows.reduce((sum, row) => sum + row.quantity * row.price, 0);
}

function periodMonthCount(period: HistoricalCleanupPeriod) {
  return Math.max(0, period.endMonth - period.startMonth + 1);
}

function periodRange(period: HistoricalCleanupPeriod) {
  const start = MONTH_NAMES[period.startMonth - 1] ?? "Unknown";
  const end   = MONTH_NAMES[period.endMonth   - 1] ?? "Unknown";
  return start === end ? start : `${start}–${end}`;
}

function periodEndLabel(period: HistoricalCleanupPeriod) {
  return `${MONTH_NAMES[period.endMonth - 1] ?? "the selected month"} ${period.year}`;
}

function nextMonthAfterCleanup(periods: HistoricalCleanupPeriod[]) {
  const latest = [...periods].sort((a, b) => (b.year * 12 + b.endMonth) - (a.year * 12 + a.endMonth))[0];
  if (!latest) return null;
  const monthIndex = latest.endMonth % 12;
  const year = latest.endMonth === 12 ? latest.year + 1 : latest.year;
  return `${MONTH_NAMES[monthIndex]} ${year}`;
}

function getTooltip(row: ServiceRow) {
  return row.note ?? `Details about ${row.serviceName}.`;
}

function isMonthlyBookkeepingRow(row: ServiceRow) {
  return row.id.endsWith("-bonus-monthly-bookkeeping")
    || row.serviceName === "Monthly QuickBooks Bookkeeping"
    || row.serviceName === "Monthly Bookkeeping";
}

// One, two or three stars next to the service level name, by package.
const SERVICE_LEVEL_STARS: Record<OptionId, number> = { maintain: 1, improve: 2, grow: 3 };

function isOnboarding(row: ServiceRow) {
  return row.serviceName === "Onboarding";
}

// ─── Option builder ───────────────────────────────────────────────────────────

function buildCleanupRows(periods: HistoricalCleanupPeriod[], maintainMonthly: number, optionId: OptionId): ServiceRow[] {
  const currentYear = new Date().getFullYear();
  return [...periods]
    .sort((a, b) => (a.year * 12 + a.startMonth) - (b.year * 12 + b.startMonth))
    .map((period) => {
      const isPrior = period.year < currentYear;
      const range    = periodRange(period);
      const platform = bookkeepingPlatformLabel(period.platform ?? "qbo");
      return {
        id: `${optionId}-cleanup-${period.year}-${period.startMonth}-${period.endMonth}`,
        serviceName: `${period.year} Catch-Up (${range})`,
        billStart: "On Acceptance",
        billEnd: "-",
        invoiceType: "Automatic",
        priceType: "Fixed",
        quantity: 1,
        price: maintainMonthly * periodMonthCount(period),
        note: isPrior
          ? `We will complete this work in ${platform}. Includes reconciliation for ${range} ${period.year}, tax-year reports, beginning and ending journal entries, and reasonable tax-preparer coordination.`
          : `We will complete this work in ${platform} and bring the books current through ${periodEndLabel(period)}. Ongoing monthly bookkeeping begins with ${nextMonthAfterCleanup(periods) ?? "the following month"}.`,
        cleanupPeriodKey: `${period.year}-${period.startMonth}-${period.endMonth}`,
        platformTag: period.platform === "stessa" ? "Stessa" : "QBO",
      };
    });
}

// Exported so the golden fixtures can assert that the service rows a signed
// proposal renders never change. This is the only place an assessment becomes
// what the client actually sees.
export function buildOptions(
  assessment: PreviewAssessment | AssessmentState,
  publishedPricing?: PublicProposalPricing,
  isTestProposal = false,
  livePublic = false,
): Record<OptionId, ProposalOption> {
  const calculatedPricing = publishedPricing ?? getProposalPricingSnapshotData(assessment as AssessmentState).packagePricing;
  const packagePricing = isTestProposal
    ? Object.fromEntries(
        optionMeta.map(({ id }) => [id, { ...calculatedPricing[id], monthly: 0 }]),
      ) as Record<OptionId, PublicProposalPricing[OptionId]>
    : calculatedPricing;
  const periods = hasCatchUpPricingInputs(assessment)
    ? (assessment.historicalCleanupPeriods ?? []).filter((p) => periodMonthCount(p) > 0)
    : [];
  const maintainMonthly = packagePricing.maintain.monthly;
  const bonuses = livePublic
    ? (assessment.bonuses ?? [])
    : getProposalBonuses(assessment as AssessmentState);

  return Object.fromEntries(optionMeta.map(({ id }) => {
    const base = baseOptions[id];

    // Onboarding row
    const onboardingRow: ServiceRow = {
      id: `${id}-onboarding`,
      serviceName: "Onboarding",
      billStart: "On Acceptance",
      billEnd: "-",
      invoiceType: "Automatic",
      priceType: "Fixed",
      quantity: 1,
      price: getOnboardingFee(assessment, periods.reduce((t, p) => t + periodMonthCount(p), 0)),
      note: assessment.ongoingBookkeepingPlatform === "qbo"
        ? "Includes our review and assessment, document collection, QuickBooks setup, and the work needed to begin. The fee is $500 plus $20 for each selected cleanup month."
        : "Includes our review and assessment, document collection, and the work needed to begin. The fee is $500 plus $20 for each selected cleanup month.",
    };

    const eligibleBonuses = bonuses
      .filter((bonus) => !bonus.archived)
      .filter((bonus) => serviceIsApplicable(assessment, bonus))
      .filter((bonus) => includedServicePackages(assessment, bonus).includes(id));

    const recurringBonuses = eligibleBonuses
      .filter((bonus) => bonus.billingCadence === "monthly")
      .map((bonus): ServiceRow => ({
        id: `${id}-bonus-${bonus.id}`,
        serviceName: bonus.name,
        billStart: "On Acceptance",
        billEnd: "Until Cancelled",
        billEvery: "1 Month",
        invoiceType: "Automatic",
        priceType: "Fixed",
        quantity: 1,
        price: 0,
        note: bonus.description,
      }));

    const oneTimeBonuses = eligibleBonuses
      .filter((bonus) => bonus.billingCadence !== "monthly")
      .map((bonus): ServiceRow => ({
        id: `${id}-bonus-${bonus.id}`,
        serviceName: bonus.name,
        billStart: "On Acceptance",
        billEnd: "-",
        invoiceType: "Automatic",
        priceType: "Fixed",
        quantity: 1,
        price: 0,
        note: bonus.description,
      }));

    return [id, {
      ...base,
      name: resolveProposalPackageName(assessment.packageNames, id),
      monthlyPrice: packagePricing[id].monthly,
      recurringRows: recurringBonuses.map((row) =>
        isMonthlyBookkeepingRow(row)
          ? {
              ...row,
              platformTag:
                assessment.ongoingBookkeepingPlatform === "stessa"
                  ? ("Stessa" as const)
                  : assessment.ongoingBookkeepingPlatform === "sage"
                    ? ("Sage" as const)
                    : ("QBO" as const),
            }
          : row,
      ),
      oneTimeRows: [
        ...buildCleanupRows(periods, maintainMonthly, id),
        onboardingRow,
        ...oneTimeBonuses,
      ],
    }];
  })) as Record<OptionId, ProposalOption>;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TooltipIcon({ row }: { row: ServiceRow }) {
  const tip = getTooltip(row);
  return (
    <span className="group relative inline-flex shrink-0">
      <button type="button" aria-label={`More information about ${row.serviceName}`} className="ui-focus-ring rounded-full text-slate-400 hover:text-brandnavy focus:text-brandnavy focus:outline-none">
        <CircleHelp className="h-3.5 w-3.5" />
      </button>
      <span role="tooltip" className="ui-tooltip pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-64 rounded-lg px-3 py-2 text-left text-xs font-normal leading-5 shadow-lg group-hover:block group-focus-within:block">
        {tip}
      </span>
    </span>
  );
}

function ServiceLine({ row, selected = true, onToggle, showPriceWhenUnselected = false, priceSuffix = "", originalPrice, waivedLabel }: {
  row: ServiceRow;
  selected?: boolean;
  onToggle?: (checked: boolean) => void;
  showPriceWhenUnselected?: boolean;
  priceSuffix?: string;
  originalPrice?: number;
  waivedLabel?: string;
}) {
  const currentPrice = row.price * row.quantity;
  const showWaivedPrice = originalPrice != null && originalPrice > currentPrice;
  return (
    <li>
      <div className="flex justify-between gap-3">
        <span className="inline-flex items-center gap-1.5">
          {onToggle ? <input type="checkbox" checked={selected} onChange={(e) => onToggle(e.target.checked)} aria-label={`${selected ? "Remove" : "Add"} ${row.serviceName}`} className="h-4 w-4 shrink-0 accent-brandnavy" /> : null}
          <TooltipIcon row={row} />
          <span className="text-slate-900">{row.serviceName}</span>
          {waivedLabel ? <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">{waivedLabel}</span> : null}
          {row.platformTag && !row.cleanupPeriodKey ? <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brandnavy">{row.platformTag}</span> : null}
        </span>
        <span className={`shrink-0 text-right font-medium ${selected ? "text-slate-900" : "text-slate-400"}`}>
          {selected || showPriceWhenUnselected ? (
            showWaivedPrice ? (
              <>
                <span className="mr-1.5 text-slate-400 line-through">{fmt(originalPrice)}{priceSuffix}</span>
                {fmt(currentPrice)}{priceSuffix}
              </>
            ) : (
              `${fmt(currentPrice)}${priceSuffix}`
            )
          ) : "Not added"}
        </span>
      </div>
    </li>
  );
}

function PreviewEditButton({
  label,
  onClick,
  className = "",
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-md transition hover:border-slate-500 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brandnavy/30 ${className}`}
    >
      <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type OfferProposalPreviewProps = {
  initialAssessment?: Partial<AssessmentState>;
  initialContactInfo?: Partial<ContactInfoState>;
  live?: boolean;
  embedded?: boolean;
  assessment?: AssessmentState;
  issuedAt?: Date | string | null;
  catalogOffer?: ReturnType<typeof getUrgencyOfferDisplay> | null;
  engagementId?: string | null;
  agreementTemplate?: AgreementTemplateOption | null;
  isTestProposal?: boolean;
  isStaffPreview?: boolean;
  alreadySigned?: boolean;
  editMode?: boolean;
  onEdit?: (target: ProposalPreviewEditTarget) => void;
  proposalToken?: string | null;
  publishedPricing?: PublicProposalPricing;
  publicProposal?: PublicBookkeepingProposal;
  /**
   * Render as a live mirror of the builder running in another tab: read the
   * builder's local state, follow its edits, and never write back.
   */
  mirrorBuilderState?: boolean;
};

export default function OfferProposalPreview(props: OfferProposalPreviewProps = {}) {
  if (props.live && props.publicProposal) {
    return (
      <OfferProposalPreviewView
        {...props}
        assessment={props.publicProposal.assessment}
        contactInfo={props.publicProposal.contactInfo}
        publishedPricing={props.publicProposal.pricing}
        livePublic
      />
    );
  }
  return <HydratedOfferProposalPreview {...props} />;
}

function HydratedOfferProposalPreview({
  initialAssessment,
  initialContactInfo,
  live = false,
  assessment: assessmentOverride,
  publishedPricing,
  mirrorBuilderState = false,
  ...rest
}: OfferProposalPreviewProps) {
  const { assessment: storedAssessment } = useProposalAssessmentDemoState({
    initialAssessment,
    persist: !live && !assessmentOverride,
    syncExternal: mirrorBuilderState,
  });
  const { contactInfo } = useProposalContactInfoDemoState({
    initialContactInfo,
    persist: !live,
    syncExternal: mirrorBuilderState,
  });
  return (
    <OfferProposalPreviewView
      {...rest}
      live={live}
      assessment={assessmentOverride ?? storedAssessment}
      contactInfo={contactInfo}
      publishedPricing={publishedPricing}
      mirrorBuilderState={mirrorBuilderState}
    />
  );
}

function OfferProposalPreviewView({
  live = false,
  embedded = false,
  assessment,
  contactInfo,
  catalogOffer = null,
  engagementId: engagementIdProp = null,
  agreementTemplate = null,
  isTestProposal = false,
  isStaffPreview = false,
  alreadySigned: alreadySignedProp = false,
  editMode = false,
  onEdit,
  proposalToken = null,
  publishedPricing,
  livePublic = false,
}: Omit<OfferProposalPreviewProps, "assessment" | "initialAssessment" | "initialContactInfo" | "publicProposal"> & {
  assessment: PreviewAssessment | AssessmentState;
  contactInfo: PreviewContactInfo;
  livePublic?: boolean;
}) {
  const { brand } = useBrand();
  const searchParams = useSearchParams();
  const contractFollowsPayment = (assessment as { contractFollowsPayment?: boolean }).contractFollowsPayment === true;
  const isSimulation = isProposalPreviewSimulation({ live, embedded, isStaffPreview });
  const startsSigned = live && !isSimulation && alreadySignedProp;
  // Preview surfaces are deliberately detached from engagement-backed APIs.
  // Even if an engagement id is accidentally supplied, preview interactions
  // must remain local and must not affect proposal or CRM lifecycle state.
  const engagementId = resolveProposalInteractionEngagementId({
    live,
    embedded,
    isStaffPreview,
    engagementId: engagementIdProp,
    searchParamEngagementId: searchParams.get("engagementId"),
  });

  const primary = resolvePrimaryContact(contactInfo);
  const contactName = formatPersonName(primary.firstName, primary.lastName) || contactInfo.owners[0]?.firstName || "";
  const companyName = contactInfo.companyName || contactName || "Your business";

  const theme = getProposalTheme(assessment.proposalTheme || DEFAULT_PROPOSAL_THEME_ID);
  const proposalMode: ProposalMode = assessment.proposalMode ?? DEFAULT_PROPOSAL_MODE;
  const brandLight = brand.theme?.proposalLightColor ?? brand.theme?.lightColor ?? "#17324d";
  const brandAccent = brand.theme?.proposalAccentColor ?? brand.theme?.accentColor ?? "#d79b3b";
  const configuredBrandDark = brand.theme?.darkColor ?? brandLight;
  const lightColor =
    proposalMode === "dark" && theme.darkLight ? theme.darkLight : theme.light ?? brandLight;
  const accentColor =
    proposalMode === "dark" && theme.darkAccent ? theme.darkAccent : theme.accent ?? brandAccent;
  const brandDark = theme.light === null ? configuredBrandDark : lightColor;
  const brandDarkForeground = readableForegroundColor(brandDark);
  const tierColors: Record<OptionId, TierColor> = {
    grow: { background: GROW_TIER_COLOR, foreground: readableForegroundColor(GROW_TIER_COLOR) },
    improve: { background: brandDark, foreground: brandDarkForeground },
    maintain: { background: MAINTAIN_TIER_COLOR, foreground: readableForegroundColor(MAINTAIN_TIER_COLOR) },
  };
  const actionColor = accentColor;
  const pageBg = theme.pageBg[proposalMode];
  const primaryActionVariables = primaryActionCssVariables(actionColor);
  const overlayVariables = overlaySurfaceCssVariables({ mode: proposalMode, dark: brandDark });
  // Ink color for text and glyphs. brandDark is a dark shade — readable on light bgs
  // in light mode. In dark mode, lighten it heavily so text stays legible on dark surfaces.
  const inkColor = getProposalInkColor(proposalMode, brandDark, theme.id);
  const lightSurfaceInk = getProposalSurfaceTextColor("#ffffff", brandDark);
  // Proposal cards use explicit theme surfaces. Grok keeps near-black cards even
  // though its dark-mode heading and accent colors intentionally invert to white.
  const darkSurfaceColors = proposalMode === "dark"
    ? getProposalDarkSurfaceColors(theme.id, brandDark)
    : null;
  const darkSurfaceOverrides = darkSurfaceColors
    ? {
        "--surface": darkSurfaceColors.surface,
        "--surface-subtle": darkSurfaceColors.subtle,
        "--surface-control": darkSurfaceColors.control,
        "--surface-row-alt": darkSurfaceColors.rowAlt,
      }
    : {};
  const stepperPrimaryVariables = {
    "--action-primary-background": lightSurfaceInk,
    "--action-primary-foreground": readableForegroundColor(lightSurfaceInk),
    "--action-primary-border": lightSurfaceInk,
  } as React.CSSProperties;
  const stepperSecondaryVariables = {
    "--action-secondary-background": `color-mix(in srgb, ${lightSurfaceInk} 10%, white)`,
    "--action-secondary-hover-background": `color-mix(in srgb, ${lightSurfaceInk} 16%, white)`,
    "--action-secondary-foreground": lightSurfaceInk,
    "--action-secondary-border": `color-mix(in srgb, ${lightSurfaceInk} 36%, white)`,
  } as React.CSSProperties;
  const logoUrl =
    proposalMode === "dark"
      ? brand.theme?.logoDarkUrl ?? brand.theme?.logoUrl ?? null
      : brand.theme?.logoUrl ?? null;
  // Subtle accent-tinted surface used behind table section headers. In light mode it's
  // a very pale wash of brandDark on white; in dark mode we mix toward black so the
  // header still reads as a subtle band on the dark preview.
  const subtleAccentBg = getProposalSectionHeaderBackground(proposalMode, brandDark);
  const accentHeaderBg = getProposalAccentHeaderBackground(proposalMode, accentColor);
  const urgencyOffer = catalogOffer?.active ? catalogOffer : getUrgencyOfferDisplay(DEFAULT_URGENCY_OFFER);

  const options = buildOptions(
    assessment,
    publishedPricing,
    isTestProposal || assessment.isTestProposal === true,
    livePublic,
  );
  const [selectedOptionId, setSelectedOptionId] = useState<OptionId | null>(null);
  const [selectionSubmittingId, setSelectionSubmittingId] = useState<OptionId | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [step, setStep] = useState(startsSigned ? 3 : 0);
  // Mobile pricing: tabs above a swipeable row of package cards, kept in sync both ways.
  const packageCarouselRef = useRef<HTMLDivElement | null>(null);
  const packageCardRefs = useRef<Partial<Record<OptionId, HTMLElement | null>>>({});
  // While a tab tap is sliding the cards, ignore the cards passed on the way.
  const packageScrollTargetRef = useRef<{ id: OptionId; until: number } | null>(null);
  const [activePackageId, setActivePackageId] = useState<OptionId>(optionMeta[0].id);
  const trackEvent = useProposalTracking({
    enabled: live && livePublic && !isSimulation && !embedded,
    token: proposalToken,
    step,
  });
  const [hasStartedIntroVideo, setHasStartedIntroVideo] = useState(false);
  const [isIntroVideoPlaying, setIsIntroVideoPlaying] = useState(false);
  const [introVideoError, setIntroVideoError] = useState<string | null>(null);
  const [streamSdkReady, setStreamSdkReady] = useState(false);
  const [hasTwelveMonthAgreement, setHasTwelveMonthAgreement] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [cleanupSelections, setCleanupSelections] = useState<Record<string, boolean>>({});
  const [storedAdditionalOptionSelections, setAdditionalOptionSelections] = useState<Record<OptionId, Record<string, boolean>>>({ grow: {}, improve: {}, maintain: {} });

  // Signing / payment state
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const [email, setEmail] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [readAndAgreedChecked, setReadAndAgreedChecked] = useState(false);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [alreadySigned, setAlreadySigned] = useState(startsSigned);
  const [signedSignerName, setSignedSignerName] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [signSubmitting, setSignSubmitting] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [paymentWaived, setPaymentWaived] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"succeeded" | "processing" | null>(null);
  const [checkoutSummary, setCheckoutSummary] = useState<CheckoutSummary | null>(null);
  const [agreementText, setAgreementText] = useState("");
  const [agreementManagerStatus, setAgreementManagerStatus] = useState<"ACTIVE" | "VOIDED" | "VOIDED_BEFORE_SIGNATURE" | "CANCELLATION_REQUESTED" | "TERMINATED_AFTER_SIGNATURE" | "ARCHIVED">("ACTIVE");
  const [cancellationName, setCancellationName] = useState("");
  const [cancellationEmail, setCancellationEmail] = useState("");
  const [cancellationSubmitting, setCancellationSubmitting] = useState(false);
  const [cancellationError, setCancellationError] = useState<string | null>(null);
  const [agreementLoading, setAgreementLoading] = useState(Boolean(engagementId));
  const agreementScrollRef = useRef<HTMLDivElement>(null);
  const streamIframeRef = useRef<HTMLIFrameElement>(null);
  const streamPlayerRef = useRef<CloudflareStreamPlayer | null>(null);
  const playRequestedRef = useRef(false);
  const coverMedia = resolveCoverMedia(
    {
      featuredMediaId: assessment.featuredMediaId ?? "",
      featuredVideoUrl: assessment.featuredVideoUrl ?? "",
      featuredImageUrl: assessment.featuredImageUrl ?? "",
    },
    {
      videoUrl: brand.theme?.proposalFeaturedVideoUrl ?? null,
      imageUrl: brand.theme?.proposalFeaturedImageUrl ?? null,
    },
  );
  const introVideoUrl = coverMedia.videoUrl;
  const introEmbedUrl = resolveVideoEmbedUrl(introVideoUrl);

  useEffect(() => {
    if (!introEmbedUrl || !isCloudflareStreamEmbed(introEmbedUrl)) return;

    void loadCloudflareStreamSdk()
      .then(() => setStreamSdkReady(true))
      .catch(() => setIntroVideoError("Unable to load the testimonial player. Please refresh and try again."));
  }, [introEmbedUrl]);

  useEffect(() => {
    const iframe = streamIframeRef.current;
    if (!iframe || !streamSdkReady || !introEmbedUrl || !isCloudflareStreamEmbed(introEmbedUrl)) return;

    let disposed = false;
    const handlePlay = () => {
      setHasStartedIntroVideo(true);
      setIsIntroVideoPlaying(true);
      setIntroVideoError(null);
      trackEvent({ type: "video_play", step: 0 });
    };
    const handlePauseOrEnded = () => setIsIntroVideoPlaying(false);

    const startPlayback = (player: CloudflareStreamPlayer) => {
      void player.play().catch(() => {
        player.muted = true;
        return player.play().catch(() => {
          setIsIntroVideoPlaying(false);
          setIntroVideoError("Unable to start the testimonial. Please use the video controls to play it.");
        });
      });
    };

    void loadCloudflareStreamSdk()
      .then((Stream) => {
        if (disposed) return;
        const player = Stream(iframe);
        streamPlayerRef.current = player;
        player.addEventListener("play", handlePlay);
        player.addEventListener("pause", handlePauseOrEnded);
        player.addEventListener("ended", handlePauseOrEnded);
        if (playRequestedRef.current) startPlayback(player);
      })
      .catch(() => setIntroVideoError("Unable to load the testimonial player. Please refresh and try again."));

    return () => {
      disposed = true;
      streamPlayerRef.current?.removeEventListener("play", handlePlay);
      streamPlayerRef.current?.removeEventListener("pause", handlePauseOrEnded);
      streamPlayerRef.current?.removeEventListener("ended", handlePauseOrEnded);
      streamPlayerRef.current = null;
    };
  }, [introEmbedUrl, streamSdkReady, trackEvent]);

  function toggleIntroVideo() {
    const player = streamPlayerRef.current;
    const playing = player && typeof player.paused === "boolean"
      ? !player.paused
      : isIntroVideoPlaying;

    if (playing) {
      playRequestedRef.current = false;
      player?.pause();
      setIsIntroVideoPlaying(false);
      return;
    }

    playRequestedRef.current = true;
    setHasStartedIntroVideo(true);
    setIsIntroVideoPlaying(true);
    setIntroVideoError(null);
    if (!player) return;
    void player.play().catch(() => {
      player.muted = true;
      return player.play().catch(() => {
        setIsIntroVideoPlaying(false);
        setIntroVideoError("Unable to start the testimonial. Please use the video controls to play it.");
      });
    });
  }

  useEffect(() => {
    if (step !== 2 && step !== 3 || !engagementId) return;
    fetch(`/api/proposal/${engagementId}/agreement`, { headers: proposalHeaders(proposalToken) })
      .then((r) => r.json())
      .then((result: { text?: string; signed?: boolean; signerName?: string | null; signedAt?: string | null; onboardingFeeStatus?: string | null; agreementManagerStatus?: typeof agreementManagerStatus; checkout?: CheckoutSummary }) => {
        setAgreementText(result.text ?? "");
        setAgreementManagerStatus(result.agreementManagerStatus ?? "ACTIVE");
        if (result.checkout && typeof result.checkout.amountDueNow === "number") {
          setCheckoutSummary(result.checkout);
          setSelectedOptionId(result.checkout.tier);
          setHasTwelveMonthAgreement(result.checkout.hasTwelveMonthAgreement === true);
        }
        if (result.signed) {
          setAlreadySigned(true);
          setSignedSignerName(result.signerName ?? null);
          setSignedAt(result.signedAt ?? null);
          if (result.agreementManagerStatus === "CANCELLATION_REQUESTED" || result.agreementManagerStatus === "TERMINATED_AFTER_SIGNATURE" || result.agreementManagerStatus === "VOIDED_BEFORE_SIGNATURE") return;
          if (result.onboardingFeeStatus === "PAID" || (result.onboardingFeeStatus === "WAIVED" && result.checkout?.amountDueNow === 0 && !isTestProposal)) {
            setPaymentStatus("succeeded");
            if (result.onboardingFeeStatus === "WAIVED") setPaymentWaived(true);
          } else {
            fetch(`/api/proposal/${engagementId}/payment-intent`, { method: "POST", headers: proposalHeaders(proposalToken) })
              .then((r) => r.json())
              .then((pr: { clientSecret?: string; waived?: boolean; alreadyResolved?: boolean }) => {
                if (pr.waived) {
                  setPaymentWaived(true);
                  setPaymentStatus("succeeded");
                } else if (pr.alreadyResolved) {
                  setPaymentStatus("succeeded");
                } else if (pr.clientSecret) {
                  setPaymentClientSecret(pr.clientSecret);
                }
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => {})
      .finally(() => setAgreementLoading(false));
  }, [step, engagementId, isTestProposal, proposalToken]);

  function checkAgreementScrolled(el: HTMLDivElement) {
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) setHasScrolledToEnd(true);
  }

  useEffect(() => {
    if (agreementLoading || hasScrolledToEnd) return;
    const el = agreementScrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.clientHeight <= 20) setHasScrolledToEnd(true);
  }, [agreementLoading, agreementText, hasScrolledToEnd]);

  function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  const canSignAgreement = signerName.trim().length > 0 && isValidEmail(email) && consentChecked && readAndAgreedChecked && hasScrolledToEnd;

  async function confirmStripePayment(status: "succeeded" | "processing") {
    if (isSimulation) {
      setPaymentStatus(status);
      return;
    }
    if (status === "processing") {
      setPaymentStatus("processing");
      return;
    }
    if (!engagementId) throw new Error("This payment is not attached to a proposal.");
    const recorded = await waitForRecordedProposalPayment({
      engagementId,
      headers: proposalHeaders(proposalToken),
    });
    setPaymentStatus(recorded === "paid" ? "succeeded" : "processing");
  }

  async function selectOptionAndContinue(id: OptionId) {
    setSelectionError(null);
    trackEvent({ type: "package_select", step, packageId: id, position: optionMeta.findIndex((meta) => meta.id === id) });

    if (!engagementId) {
      setSelectedOptionId(id);
      setStep(2);
      return;
    }

    setSelectionSubmittingId(id);
    try {
      const selectedCleanupPeriodKeys = cleanupPeriods
        .map((period) => `${period.year}-${period.startMonth}-${period.endMonth}`)
        .filter((periodKey) => cleanupIsSelected(id, periodKey));
      const selectedAdditionalOptionIds = additionalOptionRowsFor(id)
        .filter((row) => additionalOptionSelections[id][row.id] === true)
        .map((row) => row.id);
      const response = await fetch(`/api/proposal/${engagementId}/select`, {
        method: "POST",
        headers: proposalHeaders(proposalToken, true),
        body: JSON.stringify({
          tier: id,
          hasTwelveMonthAgreement,
          selectedCleanupPeriodKeys,
          selectedAdditionalOptionIds,
        }),
      });
      const result = await response.json().catch(() => null) as { error?: string; checkout?: CheckoutSummary } | null;
      if (!response.ok) {
        throw new Error(result?.error ?? "We couldn't save your service selection. Please try again.");
      }

      setSelectedOptionId(id);
      if (result?.checkout) setCheckoutSummary(result.checkout);
      setStep(2);
    } catch (error) {
      setSelectionError(
        error instanceof Error
          ? error.message
          : "We couldn't save your service selection. Please try again.",
      );
    } finally {
      setSelectionSubmittingId(null);
    }
  }

  async function submitSignatureAndContinue() {
    if (!alreadySigned && !canSignAgreement) return;
    if (isSimulation) {
      if (!alreadySigned) {
        setAlreadySigned(true);
        setSignedSignerName(signerName.trim());
        setSignedAt(new Date().toISOString());
      }
      setStep(3);
      return;
    }
    if (!engagementId) { setStep(3); return; }
    setSignSubmitting(true);
    setSignError(null);
    try {
      if (!alreadySigned) {
        const response = await fetch(`/api/proposal/${engagementId}/sign`, {
          method: "POST",
          headers: proposalHeaders(proposalToken, true),
          body: JSON.stringify({
            signerName,
            signerTitle,
            email,
            consentToElectronicSignature: consentChecked,
            confirmedReadAndAgreed: readAndAgreedChecked,
            confirmedScrolledAgreement: hasScrolledToEnd,
          }),
        });
        const result = await response.json().catch(() => null) as { error?: string; signerName?: string; signedAt?: string } | null;
        if (!response.ok) { setSignError(result?.error ?? "Something went wrong. Please try again."); return; }
        setAlreadySigned(true);
        setSignedSignerName(result?.signerName ?? signerName);
        setSignedAt(result?.signedAt ?? null);
      }
      if (paymentStatus === "succeeded") {
        setStep(3);
        return;
      }
      if (!requiresOnboardingPayment) {
        setPaymentStatus("succeeded");
        setStep(3);
        return;
      }
      const paymentResponse = await fetch(`/api/proposal/${engagementId}/payment-intent`, { method: "POST", headers: proposalHeaders(proposalToken) });
      const paymentResult = await paymentResponse.json().catch(() => null) as { clientSecret?: string; waived?: boolean; alreadyResolved?: boolean; error?: string } | null;
      if (!paymentResponse.ok) {
        throw new Error(paymentResult?.error ?? "Unable to start payment");
      }
      if (paymentResult?.waived) {
        setPaymentWaived(true);
        setPaymentStatus("succeeded");
        setStep(3);
        return;
      }
      if (paymentResult?.alreadyResolved) {
        setPaymentStatus("succeeded");
        setStep(3);
        return;
      }
      if (!paymentResult?.clientSecret) {
        throw new Error(paymentResult?.error ?? "Unable to start payment");
      }
      setPaymentClientSecret(paymentResult.clientSecret);
      setStep(3);
    } catch (error) {
      setSignError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setSignSubmitting(false);
    }
  }

  async function acknowledgeCancellation() {
    if (isSimulation) {
      setAgreementManagerStatus("TERMINATED_AFTER_SIGNATURE");
      return;
    }
    if (!engagementId || !cancellationName.trim() || !isValidEmail(cancellationEmail)) return;
    setCancellationSubmitting(true);
    setCancellationError(null);
    try {
      const response = await fetch(`/api/proposal/${engagementId}/cancel`, {
        method: "POST",
        headers: proposalHeaders(proposalToken, true),
        body: JSON.stringify({ name: cancellationName, email: cancellationEmail }),
      });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Unable to confirm cancellation.");
      setAgreementManagerStatus("TERMINATED_AFTER_SIGNATURE");
    } catch (error) {
      setCancellationError(error instanceof Error ? error.message : "Unable to confirm cancellation.");
    } finally {
      setCancellationSubmitting(false);
    }
  }
  const annualSavingsPercent = getAnnualSavingsPercent(assessment);
  const firstPaymentCredit = Math.max(0, Number((assessment as { firstPaymentCredit?: number }).firstPaymentCredit) || 0);
  const recurringDiscountMultiplier = hasTwelveMonthAgreement
    ? 1 - annualSavingsPercent / 100
    : 1;

  // Card section labels: a quiet label with a hairline.
  const sectionLabelClass = "flex items-center gap-3 px-5 pb-1 pt-5 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 after:h-px after:flex-1 after:bg-slate-200";

  function showPackage(id: OptionId) {
    const carousel = packageCarouselRef.current;
    const card = packageCardRefs.current[id];
    if (!carousel || !card) return;
    setActivePackageId(id);
    packageScrollTargetRef.current = { id, until: Date.now() + 1500 };
    carousel.scrollTo({ left: card.offsetLeft, behavior: "smooth" });
    // Deep inside a long card, bring the tops of the cards back into view too.
    if (carousel.getBoundingClientRect().top < 0) {
      carousel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function syncActivePackageFromSwipe() {
    const carousel = packageCarouselRef.current;
    if (!carousel) return;
    let closest: OptionId = activePackageId;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const { id } of optionMeta) {
      const card = packageCardRefs.current[id];
      if (!card) continue;
      const distance = Math.abs(card.offsetLeft - carousel.scrollLeft);
      if (distance < closestDistance) {
        closest = id;
        closestDistance = distance;
      }
    }
    const target = packageScrollTargetRef.current;
    if (target) {
      if (closest !== target.id && Date.now() < target.until) return;
      packageScrollTargetRef.current = null;
    }
    if (closest !== activePackageId) setActivePackageId(closest);
  }

  const cleanupPeriods = hasCatchUpPricingInputs(assessment)
    ? (assessment.historicalCleanupPeriods ?? [])
      .filter((p) => periodMonthCount(p) > 0)
      .sort((a, b) => (a.year * 12 + a.startMonth) - (b.year * 12 + b.startMonth))
    : [];

  const cleanupKey = (optionId: OptionId, periodKey: string) => `${optionId}:${periodKey}`;
  const cleanupIsSelected = (optionId: OptionId, periodKey: string) => cleanupSelections[cleanupKey(optionId, periodKey)] !== false;

  const addOns = proposalServiceAddOns({
    ...assessment,
    additionalOptions: livePublic
      ? (assessment.additionalOptions ?? [])
      : getProposalAdditionalOptions(assessment as AssessmentState),
    bonuses: livePublic
      ? (assessment.bonuses ?? [])
      : getProposalBonuses(assessment as AssessmentState),
  });
  const additionalOptionRowsFor = (packageId: OptionId): ServiceRow[] =>
    addOns.filter((option) => option.packageIds.includes(packageId)).map((option) => ({
      id: option.id,
      serviceName: option.name,
      billStart: "On Acceptance",
      billEnd: option.billingCadence === "monthly" ? "Until Cancelled" : "-",
      ...(option.billingCadence === "monthly" ? { billEvery: "1 Month" } : {}),
      invoiceType: "Automatic",
      priceType: "Fixed",
      quantity: 1,
      price: option.monthlyPrice,
      note: option.description,
      ...(option.required ? { required: true } : {}),
    }));

  // Required add-ons count as selected on every package; the client cannot untick them.
  const additionalOptionSelections = Object.fromEntries(
    (["grow", "improve", "maintain"] as const).map((packageId) => [
      packageId,
      {
        ...storedAdditionalOptionSelections[packageId],
        ...Object.fromEntries(additionalOptionRowsFor(packageId).filter((row) => row.required).map((row) => [row.id, true])),
      },
    ]),
  ) as Record<OptionId, Record<string, boolean>>;

  const recurringServiceNames = Array.from(new Set(optionMeta.flatMap(({ id }) => options[id].recurringRows.map((r) => r.serviceName))));
  const oneTimeServiceNames   = Array.from(new Set(optionMeta.flatMap(({ id }) => options[id].oneTimeRows.map((r) => r.serviceName))));

  const selectedOnboardingFee = selectedOptionId
    ? getOnboardingFee(
        assessment,
        cleanupPeriods.reduce(
          (total, period) => total + (
            cleanupIsSelected(selectedOptionId, `${period.year}-${period.startMonth}-${period.endMonth}`)
              ? periodMonthCount(period)
              : 0
          ),
          0,
        ),
      )
    : null;
  const selectedCleanupTotal = selectedOptionId
    ? options[selectedOptionId].oneTimeRows
        .filter((row) => row.cleanupPeriodKey && cleanupIsSelected(selectedOptionId, row.cleanupPeriodKey))
        .reduce((total, row) => total + row.price * row.quantity, 0)
    : 0;
  const selectedAdditionalMonthlyTotal = selectedOptionId
    ? additionalOptionRowsFor(selectedOptionId).reduce(
        (total, row) => total + (row.billEvery && additionalOptionSelections[selectedOptionId][row.id] ? row.price : 0),
        0,
      )
    : 0;
  const selectedAdditionalOneTimeTotal = selectedOptionId
    ? additionalOptionRowsFor(selectedOptionId).reduce(
        (total, row) => total + (!row.billEvery && additionalOptionSelections[selectedOptionId][row.id] ? row.price : 0),
        0,
      )
    : 0;
  const selectedMonthlyCharge = selectedOptionId
    ? Math.round(((options[selectedOptionId].monthlyPrice + selectedAdditionalMonthlyTotal) * recurringDiscountMultiplier) * 100) / 100
    : 0;
  const selectedCleanupMonths = cleanupPeriods.reduce((total, period) => total + (
    selectedOptionId && cleanupIsSelected(selectedOptionId, `${period.year}-${period.startMonth}-${period.endMonth}`) ? periodMonthCount(period) : 0
  ), 0);
  const hasCleanup = selectedCleanupMonths > 0;
  const currentSchedule = proposalPaymentSchedule({
    cleanupMonths: selectedCleanupMonths, cleanupMonthlyRate: options.maintain.monthlyPrice,
    onboardingFee: selectedOnboardingFee ?? 0, recurringMonthlyTotal: selectedMonthlyCharge,
    additionalOneTimeTotal: selectedAdditionalOneTimeTotal,
    annualPrepay: hasTwelveMonthAgreement,
    creditApplied: firstPaymentCredit,
  });
  const chargeFirstMonth = currentSchedule.firstMonthDueNow;
  const chargeOnboarding = selectedOnboardingFee ?? 0;
  const calculatedChargeAmount = currentSchedule.amountDueNow;
  const chargeAmount = isTestProposal ? 1 : checkoutSummary?.amountDueNow ?? calculatedChargeAmount;
  const stagedPayment = !checkoutSummary || checkoutSummary.paymentScheduleVersion === 2;
  const chargeIsFirstMonth = chargeFirstMonth > 0;
  const requiresOnboardingPayment = chargeAmount > 0;
  const chargeLabel = isTestProposal
    ? "$1 Test Payment"
    : stagedPayment && hasCleanup
      ? "Onboarding + Discovery"
    : selectedCleanupTotal > 0 && chargeOnboarding > 0
      ? "Cleanup + Onboarding"
      : selectedCleanupTotal > 0
        ? "Cleanup"
        : chargeOnboarding > 0 && chargeFirstMonth > 0
    ? "Onboarding + First Month"
    : chargeIsFirstMonth ? "First Month" : "Your Deposit";
  const chargeDescription = isTestProposal
    ? "This proposal is explicitly marked for testing. It exercises the real payment flow with a $1 total."
    : stagedPayment && hasCleanup
      ? "Covers onboarding and discovery, plus any selected one-time add-ons. Cleanup is estimated separately and requires your approval after discovery."
    : selectedCleanupTotal > 0
      ? "Covers the selected cleanup work and onboarding so work can begin."
      : chargeOnboarding > 0 && chargeFirstMonth > 0
    ? "Covers onboarding and prepays your first month. We confirm your service start date after receiving the required access and records."
    : chargeIsFirstMonth
      ? "Prepays your first month. We confirm your service start date during onboarding."
      : "Covers onboarding, document collection, and discovery. Earned upon signing and non-refundable.";
  const clientSteps = [
    "Cover",
    "Services",
    "Agreement",
    "Payment",
  ] as const;
  const agreementTitle =
    agreementTemplate?.name
    ?? assessment.agreementTemplateName
    ?? DEFAULT_AGREEMENT_TEMPLATE_NAME;
  const embeddedAgreementText = renderAgreementTemplate(
    agreementTemplate?.content
      ?? assessment.agreementTemplateContent
      ?? DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE,
    {
      brandName: brand.name,
      clientName: companyName,
      primaryContactName: contactName || null,
      primaryContactEmail: primary.email || null,
      selectedTierLabel: selectedOptionId ? options[selectedOptionId].name : null,
      onboardingFee: selectedOnboardingFee,
      hasCleanup,
      recurringMonthlyTotal: selectedMonthlyCharge,
      cleanupTotal: selectedCleanupTotal,
      amountDueNow: chargeAmount,
      agreementTerm: hasTwelveMonthAgreement ? "12-month" : "month-to-month",
      selectedCleanupPeriods: cleanupPeriods
        .filter((period) => selectedOptionId && cleanupIsSelected(selectedOptionId, `${period.year}-${period.startMonth}-${period.endMonth}`))
        .map((period) => `${period.year}: months ${period.startMonth}-${period.endMonth}`),
      selectedAdditionalOptionNames: selectedOptionId
        ? additionalOptionRowsFor(selectedOptionId)
            .filter((row) => additionalOptionSelections[selectedOptionId][row.id])
            .map((row) => row.serviceName)
        : [],
      paymentScheduleVersion: stagedPayment ? 2 : undefined,
      cleanupMonths: selectedCleanupMonths,
      cleanupMonthlyRate: options.maintain.monthlyPrice,
      additionalOneTimeTotal: selectedAdditionalOneTimeTotal,
      requiredOneTime: selectedOptionId
        ? additionalOptionRowsFor(selectedOptionId)
            .filter((row) => row.required && !row.billEvery)
            .map((row) => ({ name: row.serviceName, price: row.price * row.quantity }))
        : [],
      includedServices: selectedOptionId ? [
        ...options[selectedOptionId].recurringRows,
        ...options[selectedOptionId].oneTimeRows.filter((row) => row.price === 0 && !row.cleanupPeriodKey && !isOnboarding(row)),
      ].map((row) => ({ name: serviceLevelTitle(row.serviceName), description: row.note ?? "" })) : [],
    },
  );
  const displayedAgreementText = engagementId ? agreementText : embeddedAgreementText;
  const selectedPaymentPlan = stagedPayment && selectedOptionId ? (
    <ProposalPaymentPlan
      cleanupMonths={checkoutSummary?.cleanupMonths ?? selectedCleanupMonths}
      cleanupMonthlyRate={checkoutSummary?.cleanupMonthlyRate ?? options.maintain.monthlyPrice}
      onboardingFee={checkoutSummary?.onboardingFee ?? selectedOnboardingFee ?? 0}
      recurringMonthlyTotal={checkoutSummary?.recurringMonthlyTotal ?? selectedMonthlyCharge}
      additionalOneTimeTotal={checkoutSummary?.additionalOneTimeTotal ?? selectedAdditionalOneTimeTotal}
      requiredOneTime={additionalOptionRowsFor(selectedOptionId).filter((row) => row.required && !row.billEvery).map((row) => ({ name: row.serviceName, price: row.price * row.quantity }))}
      annual={checkoutSummary?.hasTwelveMonthAgreement ?? hasTwelveMonthAgreement}
      amountDueNow={chargeAmount}
      annualSavingsPercent={annualSavingsPercent}
      creditApplied={isTestProposal ? 0 : checkoutSummary?.creditApplied ?? (checkoutSummary ? 0 : firstPaymentCredit)}
      originalOnboardingFee={assessment.showOriginalOneTimePrices !== false && isOnboardingFeeWaived(assessment)
        ? getListedOnboardingFee({
          onboardingFeeOverride: assessment.onboardingFeeOverride ?? null,
          historicalCleanupPeriods: assessment.historicalCleanupPeriods ?? [],
        }, selectedCleanupMonths)
        : undefined}
      showStages
    />
  ) : null;
  const agreementIsOpen = agreementManagerStatus === "ACTIVE" || agreementManagerStatus === "ARCHIVED";

  const signedByBanner = signedSignerName ? (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
      Signed by <span className="font-semibold">{signedSignerName}</span>
      {signedAt ? ` on ${new Date(signedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : null}
    </div>
  ) : null;

  const signedAgreementCollapsible = displayedAgreementText ? (
    <details className="rounded-lg border border-slate-200 bg-white">
      <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-semibold text-slate-700 hover:text-slate-900">
        View the signed Agreement
      </summary>
      <div
        data-proposal-surface="light"
        className="max-h-[50vh] overflow-y-auto border-t border-slate-200 p-4 sm:max-h-[65vh]"
        style={{ "--proposal-light-surface-ink": lightSurfaceInk } as React.CSSProperties}
      >
        <AgreementTextView text={displayedAgreementText} />
      </div>
    </details>
  ) : null;

  // Due-today per package, filled in as the cards render; read by the mobile bottom bar.
  const mobileDueToday: Partial<Record<OptionId, number>> = {};
  // The checkout bar carries the one Select button; the cards' own buttons show only when it is absent (embedded preview, after payment).
  const showMobileSelectBar = !embedded && paymentStatus !== "succeeded";

  return (
    <main
      data-theme={proposalMode}
      data-appearance="standard"
      className={`proposal-type relative isolate overflow-hidden px-4 py-6 text-brandnavy [&_button:not(:disabled)]:cursor-pointer [&_button:disabled]:cursor-not-allowed sm:px-6 lg:px-10 ${
        embedded ? "min-h-[40rem]" : "min-h-screen"
      }`}
      style={{
        background: pageBg,
        "--theme-light": lightColor,
        "--theme-accent": accentColor,
        ...primaryActionVariables,
        ...overlayVariables,
        ...darkSurfaceOverrides,
        "--theme-dark": brandDark,
        "--theme-ink": inkColor,
        "--proposal-ink": inkColor,
        "--color-accent-500": accentColor,
        "--color-accent-100": accentHeaderBg,
      } as unknown as React.CSSProperties}
    >
      <svg aria-hidden="true" viewBox="0 0 1600 1000" preserveAspectRatio="none" className={`pointer-events-none inset-0 z-0 h-full w-full text-brandnavy opacity-[0.045] ${embedded ? "absolute" : "fixed"}`}>
        <g fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M-120 70C120 20 285 115 330 280S220 545-45 610" />
          <path d="M-145 130C75 75 235 155 270 295S165 490-70 555" />
          <path d="M1710 235C1490 125 1350 205 1325 350S1435 575 1675 650" />
          <path d="M1735 305C1535 205 1405 270 1385 385S1480 535 1695 600" />
        </g>
      </svg>

      <section className={`relative z-10 mx-auto flex max-w-[1180px] flex-col gap-6 ${embedded ? "" : "min-h-[calc(100vh-3rem)]"}`}>

        {/* Nav bar — always a white floating bar, even under dark themes */}
        <nav
          aria-label="Proposal navigation"
          data-theme="light"
          data-appearance="standard"
          className="rounded-2xl border border-slate-200 bg-white px-3 py-4 shadow-sm sm:px-5"
        >
          {/* On a phone the side spacers are dropped, Back shows as an icon, and the connecting lines stretch to fit. */}
          <div className="flex items-center gap-2 sm:grid sm:grid-cols-[auto_1fr_auto] sm:gap-4">
            {step === 0 ? <span className="hidden w-[74px] sm:block" /> : (
              <button
                type="button"
                aria-label="Back"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="ui-action-secondary inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition sm:px-5"
                style={stepperSecondaryVariables}
              >
                <ChevronLeft strokeWidth={3} className="h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </button>
            )}
            <ol className="flex min-w-0 flex-1 items-start sm:justify-center">
              {clientSteps.map((label, index) => (
                <li key={label} className={`flex items-start ${index > 0 ? "flex-1 sm:flex-none" : "shrink-0"}`}>
                  {index > 0 && <span className="mt-4 h-0.5 min-w-1 flex-1 sm:w-10 sm:flex-none" style={{ backgroundColor: index <= step ? brandDark : "#cbd5e1" }} />}
                  <div className="w-14 shrink-0 text-center sm:w-20">
                    <span
                      className={`mx-auto grid h-8 w-8 place-items-center rounded-full border text-sm font-bold ${index <= step ? "" : "border-slate-300 bg-white text-slate-500"}`}
                      style={index <= step ? { backgroundColor: lightSurfaceInk, borderColor: lightSurfaceInk, color: readableForegroundColor(lightSurfaceInk) } : undefined}
                    >
                      {index < step ? "✓" : index + 1}
                    </span>
                    <span className="mt-1 block text-[11px] text-slate-500 sm:text-xs">{label}</span>
                  </div>
                </li>
              ))}
            </ol>
            <span className="hidden w-[74px] sm:block" />
          </div>
        </nav>

        {isTestProposal ? (
          <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-950 shadow-sm">
            Test proposal — the payment step is limited to $1 and must not be sent to a lead.
          </div>
        ) : null}

        <article className="space-y-8 bg-transparent">

          {/* Header (cover + deposit only) */}
          {(step === 0 || step === 2) ? (
            <header className="relative flex flex-wrap items-center justify-between gap-4">
              {editMode && onEdit ? (
                <PreviewEditButton
                  label="Edit client details"
                  onClick={() => onEdit("contact")}
                  className="absolute -right-2 -top-2 z-20"
                />
              ) : null}
              <div>
                {logoUrl ? (
                  <div className="h-10 w-full max-w-44">
                    <img src={logoUrl} alt={brand.name} className="brand-asset-fit brand-asset-fit-left" />
                  </div>
                ) : (
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{brand.name}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Prepared for</p>
                <p className="mt-1 font-semibold" style={{ color: inkColor }}>{companyName}</p>
              </div>
            </header>
          ) : null}

          {/* Step 0 — Intro */}
          {step === 0 && (() => {
            const imageUrl = coverMedia.imageUrl;
            const embedUrl = introEmbedUrl;
            const hasMedia = !!(embedUrl || imageUrl);
            const customHeadline = assessment.introHeadline?.trim().replace("Professional local bookkeeping and registered agent services", "Professional local accounting and registered agent services") || null;
            const customBody = assessment.introBody?.trim() || null;
            const introBody = (customBody ?? `You should not have to chase your bookkeeper or guess what your numbers mean. ${brand.name} helps real estate investors with clean books, useful reports, and clear answers from a team that knows your business.`)
              .replace("Your responsible accounting partner.", "")
              .replace("Get monthly reports to improve business decisions and enjoy our proactive coordination with your tax preparer.", "Your partner for monthly accounting, professional reports, and proactive coordination with your tax preparer.");
            const registeredAgentMessage = "Registered agent services included at no additional charge.";
            const includesRegisteredAgentMessage = /registered agent services included at no charge\.?/i.test(introBody);
            const introBodyCopy = introBody.replace(/\s*registered agent services included at no charge\.?/i, "").trim();
            const mediaButton = normalizeHeroButton(assessment.heroMediaButton, DEFAULT_HERO_MEDIA_BUTTON);
            const continueButton = normalizeHeroButton(assessment.heroContinueButton, DEFAULT_HERO_CONTINUE_BUTTON);
            const mediaButtonLabel = mediaButton.label.trim() || DEFAULT_HERO_MEDIA_BUTTON.label;
            const showMediaButton = Boolean(embedUrl) && mediaButton.visible;
            const continueIsPrimary = !showMediaButton || hasStartedIntroVideo;
            const heroButtonClass = (primary: boolean) =>
              `inline-flex w-full items-center justify-center gap-2 rounded-lg border px-6 py-3 text-lg font-bold transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(15,23,42,0.22)] ${
                primary ? "ui-action-primary" : "ui-action-secondary"
              }`;
            return (
              <div className="relative pb-12 sm:pb-16">
                {editMode && onEdit ? (
                  <PreviewEditButton
                    label="Edit proposal theme"
                    onClick={() => onEdit("theme")}
                    className="absolute -right-2 -top-2 z-20"
                  />
                ) : null}
                <div className={`grid items-center gap-8 ${hasMedia ? "md:grid-cols-2" : ""}`}>
                  <div className="relative">
                    {editMode && onEdit ? (
                      <PreviewEditButton
                        label="Edit cover content"
                        onClick={() => onEdit("cover-content")}
                        className="absolute -left-2 -top-2 z-20"
                      />
                    ) : null}
                    <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: inkColor }}>
                      {customHeadline ?? (
                        <>
                          Expert <span className="text-accent-500">Real Estate</span> Bookkeeping +{" "}
                          Great <span className="text-accent-500">Communication</span>
                        </>
                      )}
                    </h1>
                    <p className={`mt-6 text-lg leading-8 text-slate-600 ${hasMedia ? "" : "max-w-2xl"}`}>
                      {introBodyCopy}
                      {includesRegisteredAgentMessage ? <span className="mt-3 flex items-center gap-2 pt-2 text-base font-semibold text-slate-600"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ backgroundColor: brandDark, color: brandDarkForeground }}><Check className="h-3 w-3" /></span>{registeredAgentMessage}</span> : null}
                    </p>
                    <div className="mt-8 space-y-3">
                      {showMediaButton ? (
                        <button
                          type="button"
                          onClick={toggleIntroVideo}
                          aria-pressed={isIntroVideoPlaying}
                          aria-label={isIntroVideoPlaying ? `Pause ${mediaButtonLabel}` : `Play ${mediaButtonLabel}`}
                          className={heroButtonClass(!continueIsPrimary)}
                        >
                          <HeroCtaContent
                            config={mediaButton}
                            fallbackLabel={DEFAULT_HERO_MEDIA_BUTTON.label}
                            playing={isIntroVideoPlaying}
                          />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className={heroButtonClass(continueIsPrimary)}
                        style={!continueIsPrimary ? { backgroundColor: "#ffffff", color: "#111827", borderColor: "#cbd5e1" } : undefined}
                      >
                        <HeroCtaContent
                          config={continueButton}
                          fallbackLabel={DEFAULT_HERO_CONTINUE_BUTTON.label}
                        />
                      </button>
                      {introVideoError ? <p role="alert" className="mt-2 text-sm text-red-700">{introVideoError}</p> : null}
                      <ProposalUrgencyNote offer={urgencyOffer} color={inkColor} />
                    </div>
                  </div>
                  {embedUrl ? (
                    <div
                      className="relative overflow-hidden rounded-xl border shadow-sm"
                      style={{ borderColor: "#cbd5e1" }}
                    >
                      {editMode && onEdit ? (
                        <PreviewEditButton
                          label="Edit cover media"
                          onClick={() => onEdit("cover-media")}
                          className="absolute right-3 top-3 z-20"
                        />
                      ) : null}
                      <CoverVideoFrame
                        embedUrl={embedUrl}
                        posterUrl={imageUrl || resolveVideoPosterUrl(embedUrl)}
                        iframeRef={streamIframeRef}
                      />
                    </div>
                  ) : imageUrl ? (
                    <div
                      className="relative overflow-hidden rounded-xl border shadow-sm"
                      style={{ borderColor: "#cbd5e1" }}
                    >
                      {editMode && onEdit ? (
                        <PreviewEditButton
                          label="Edit cover media"
                          onClick={() => onEdit("cover-media")}
                          className="absolute right-3 top-3 z-20"
                        />
                      ) : null}
                      <div className="aspect-video bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imageUrl}
                          alt={customHeadline || `${brand.name} cover image`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
                <ProposalReviewsSection brandName={brand.name} animate />
              </div>
            );
          })()}

          {/* Step 1 — Services */}
          {step === 1 && (
            <div className={`relative ${embedded ? "" : "pb-40"}`}>
              {editMode && onEdit ? (
                <PreviewEditButton
                  label="Edit package services and options"
                  onClick={() => onEdit("services")}
                  className="absolute right-0 top-0 z-20"
                />
              ) : null}
              <div className="mb-5 text-center">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: inkColor }}>Select your services</h1>
              </div>
              {urgencyOffer.active ? (
                <div className="mx-auto mb-8 max-w-3xl">
                  <ProposalUrgencyBanner offer={urgencyOffer} accentColor={actionColor} inkColor={inkColor} />
                </div>
              ) : null}
              {selectionError ? (
                <p role="alert" className="mx-auto mb-6 max-w-3xl text-center text-sm font-semibold text-rose-700">
                  {selectionError}
                </p>
              ) : null}

              {/* Billing: two tabs (all screen sizes) */}
              <div className="relative mx-auto mb-3 max-w-2xl">
                {editMode && onEdit ? (
                  <PreviewEditButton
                    label="Edit annual pricing discount"
                    onClick={() => onEdit("pricing")}
                    className="absolute -right-10 top-1/2 z-20 -translate-y-1/2"
                  />
                ) : null}
                <div role="tablist" aria-label="Billing" className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1 text-sm font-bold">
                  {([false, true] as const).map((annual) => {
                    const active = hasTwelveMonthAgreement === annual;
                    return (
                      <button
                        key={annual ? "annual" : "monthly"}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setHasTwelveMonthAgreement(annual)}
                        className={`rounded-xl px-3 py-2.5 transition ${active ? "bg-white shadow-sm" : "text-slate-500"}`}
                        style={active ? { color: inkColor } : undefined}
                      >
                        {annual ? (annualSavingsPercent > 0 ? `Annual · Save ${annualSavingsPercent}%` : "Annual") : "Month-to-month"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mobile package tabs above the cards; a slim copy also rides in the bottom bar */}
              <MobilePackageTabs className="mx-auto mb-4 max-w-2xl" options={options} activeId={activePackageId} discountMultiplier={recurringDiscountMultiplier}
                tierColors={tierColors} inkColor={inkColor} onSelect={showPackage} />

              {/* Package cards: one in view at a time, swipeable, driven by the package tabs */}
              <div
                ref={packageCarouselRef}
                onScroll={syncActivePackageFromSwipe}
                className="relative mx-auto flex max-w-2xl scroll-mt-4 snap-x snap-mandatory items-start gap-4 overflow-x-auto pb-2 [scrollbar-width:none]">
                {optionMeta.map(({ id, serviceLevel }) => {
                  const option = options[id];
                  const selected = selectedOptionId === id;

                  const selectedCleanupMonths = cleanupPeriods.reduce(
                    (t, p) => t + (cleanupIsSelected(id, `${p.year}-${p.startMonth}-${p.endMonth}`) ? periodMonthCount(p) : 0),
                    0,
                  );

                  const packageAdditionalOptionRows = additionalOptionRowsFor(id);
                  const selectedOneTimeAdditionalRows = packageAdditionalOptionRows.filter(
                    (row) => !row.billEvery && additionalOptionSelections[id][row.id],
                  );
                  const effectiveOneTimeRows = [...option.oneTimeRows, ...selectedOneTimeAdditionalRows].map((row) =>
                    isOnboarding(row)
                      ? { ...row, price: getOnboardingFee(assessment, selectedCleanupMonths) }
                      : row,
                  );

                  // The annual discount covers every recurring line, add-ons included.
                  const recurringTotal = Math.round((
                    (option.monthlyPrice +
                      packageAdditionalOptionRows.reduce(
                        (total, row) => total + (row.billEvery && additionalOptionSelections[id][row.id] ? row.price : 0),
                        0,
                      )) * recurringDiscountMultiplier) * 100) / 100;

                  const onboardingWaived = isOnboardingFeeWaived(assessment);
                  const originalOnboardingFee = getListedOnboardingFee({
                    onboardingFeeOverride: assessment.onboardingFeeOverride ?? null,
                    historicalCleanupPeriods: assessment.historicalCleanupPeriods ?? [],
                  }, selectedCleanupMonths);
                  const onboardingFee = getOnboardingFee(assessment, selectedCleanupMonths);
                  const additionalOneTimeTotal = sectionTotal(selectedOneTimeAdditionalRows);
                  const schedule = proposalPaymentSchedule({
                    cleanupMonths: selectedCleanupMonths, cleanupMonthlyRate: options.maintain.monthlyPrice,
                    onboardingFee, recurringMonthlyTotal: recurringTotal, additionalOneTimeTotal,
                    annualPrepay: hasTwelveMonthAgreement,
                    creditApplied: firstPaymentCredit,
                  });
                  mobileDueToday[id] = isTestProposal ? 1 : schedule.amountDueNow;
                  const paidOneTime      = effectiveOneTimeRows.filter((r) => r.price > 0);
                  const optionalCleanup  = paidOneTime.filter((r) => r.cleanupPeriodKey);
                  const requiredAddOnRows = packageAdditionalOptionRows.filter((r) => r.required);
                  const optionalAdditionalRows = packageAdditionalOptionRows.filter((r) => !r.required);
                  const requiredOnboard  = effectiveOneTimeRows.filter((r) => !r.cleanupPeriodKey && isOnboarding(r) && (r.price > 0 || onboardingWaived));
                  const additionalSetup  = paidOneTime.filter((r) => !r.cleanupPeriodKey && !isOnboarding(r) && !packageAdditionalOptionRows.some((addOn) => addOn.id === r.id));

                  const lowerTierId: OptionId | null = id === "grow" ? "improve" : id === "improve" ? "maintain" : null;
                  const { includedRows } = pricingCardServices(option, lowerTierId ? options[lowerTierId] : undefined);
                  // One package is in view at a time, so each card lists everything; rows new at this tier stay highlighted.
                  const newAtThisTier = new Set(includedRows.map((row) => row.id));
                  // Order: service level first, then what this tier adds, then what it carries over.
                  const includedRank = (row: (typeof includedRows)[number]) =>
                    row.serviceName.endsWith("Client Support") ? 0 : newAtThisTier.has(row.id) ? 1 : 2;
                  const allIncludedRows = pricingCardServices(option).includedRows
                    .map((row, index) => ({ row, index }))
                    .sort((a, b) => includedRank(a.row) - includedRank(b.row) || a.index - b.index)
                    .map(({ row }) => row);
                  const renderIncludedRow = (row: (typeof allIncludedRows)[number], emphasized: boolean) => (
                    <li key={row.id} className={`flex justify-between gap-3 ${emphasized ? "font-semibold text-emerald-700" : "text-slate-600"}`}>
                      <span className="inline-flex items-start gap-1.5">
                        <span className="group relative inline-flex shrink-0">
                          <button type="button" aria-label={`More information about ${row.serviceName}`} className={`ui-focus-ring rounded-full hover:text-brandnavy focus:outline-none ${emphasized ? "text-emerald-600" : "text-slate-400"}`}><CircleHelp className="h-3.5 w-3.5" /></button>
                          <span role="tooltip" className="ui-tooltip pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-64 rounded-lg px-3 py-2 text-left text-xs font-normal leading-5 shadow-lg group-hover:block group-focus-within:block">{getTooltip(row)}</span>
                        </span>
                        <span>
                          {serviceLevelTitle(row.serviceName)}
                          {/* Support levels carry their time promise inline, e.g. "White-Glove Concierge · 24/7". */}
                          {SERVICE_LEVEL_COPY[row.serviceName] ? <> · <strong className="font-bold">{SERVICE_LEVEL_COPY[row.serviceName].emphasis}</strong></> : null}
                        </span>
                        {row.platformTag ? <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">{row.platformTag}</span> : null}
                      </span>
                    </li>
                  );
                  const supportRows = [...option.recurringRows, ...option.oneTimeRows.filter((row) => row.price === 0)]
                    .filter((row) => row.serviceName.endsWith("Client Support"));

                  return (
                    <section key={id} ref={(el) => { packageCardRefs.current[id] = el; }} data-track-package={id} data-track-position={optionMeta.findIndex((meta) => meta.id === id)} className="w-full shrink-0 snap-start overflow-hidden rounded-xl border border-t-4 bg-white shadow-sm transition-colors" style={{ borderColor: selected ? brandDark : "#e2e8f0", borderTopColor: tierColors[id].background }}>
                      {/* Card header + service level (one grid row so the cards stay aligned) */}
                      <div>
                        <div className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h2 className="text-2xl font-bold" style={{ color: inkColor }}>{option.name}</h2>
                              {editMode && onEdit ? (
                                <PreviewEditButton
                                  label={`Edit ${option.name} package name and services`}
                                  onClick={() => onEdit("services")}
                                />
                              ) : null}
                            </div>
                            <button type="button" onClick={() => setComparisonOpen(true)} className="mt-1 hidden text-xs font-semibold underline underline-offset-2" style={{ color: inkColor }}>
                              See everything included
                            </button>
                          </div>
                          <div className="flex items-start gap-2">
                            {editMode && onEdit ? (
                              <PreviewEditButton
                                label={`Edit ${option.name} pricing`}
                                onClick={() => onEdit("pricing")}
                              />
                            ) : null}
                          </div>
                        </div>
                        </div>
                        <section className="border-t border-slate-200">
                          <p className={sectionLabelClass}>Service level</p>
                          <div className="space-y-3 px-5 py-4">
                            {supportRows.length > 0 ? supportRows.map((row) => (
                              <div key={row.id} aria-label={`${option.name} support level`}>
                                <p className="flex items-center gap-2 text-base font-semibold text-slate-900">
                                  <span role="img" aria-label={`${SERVICE_LEVEL_STARS[id]} of 3 stars`} className="inline-flex shrink-0 gap-0.5" style={{ color: "#f4b422" }}>
                                    {Array.from({ length: SERVICE_LEVEL_STARS[id] }, (_, i) => <Star key={i} aria-hidden="true" className="h-4 w-4 fill-current" />)}
                                  </span>
                                  {SERVICE_LEVEL_COPY[row.serviceName]?.title ?? row.serviceName}
                                </p>
                                {/* Only real copy earns this space; the tooltip fallback is filler. */}
                                {(SERVICE_LEVEL_COPY[row.serviceName]?.meaning ?? row.note) ? <p className="mt-1 text-sm leading-6 text-slate-600">{(() => {
                                  const copy = SERVICE_LEVEL_COPY[row.serviceName];
                                  const parts = copy ? splitServiceLevelMeaning(copy.meaning, copy.emphasis) : null;
                                  return parts ? <>{parts.before}<strong className="font-bold text-slate-800">{parts.emphasis}</strong>{parts.after}</> : (copy?.meaning ?? row.note);
                                })()}</p> : null}
                              </div>
                            )) : <p className="text-sm font-semibold text-slate-900">{serviceLevel}</p>}
                          </div>
                        </section>
                      </div>

                      {/* One-time services */}
                      <section className="border-t border-slate-200">
                        <p className={sectionLabelClass}>One-time services</p>
                        <div className="px-5 py-4">
                          {requiredOnboard.length || requiredAddOnRows.length ? <div className="mt-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-700">Required to get started</p><ul className="mt-2 space-y-2 text-sm text-slate-600">{requiredOnboard.map((row) => <ServiceLine key={row.id} row={{ ...row, serviceName: schedule.hasCleanup ? "Onboarding + Discovery" : "Onboarding", note: schedule.hasCleanup ? "Account access, document collection, and discovery to confirm the cleanup scope and estimate. Cleanup work is approved separately afterward." : "Account access, document collection, and setup for ongoing bookkeeping." }} originalPrice={assessment.showOriginalOneTimePrices !== false && isOnboarding(row) && originalOnboardingFee > row.price ? originalOnboardingFee : undefined} waivedLabel={onboardingWaived && isOnboarding(row) ? "Waived" : undefined} />)}{requiredAddOnRows.map((row) => <ServiceLine key={row.id} row={{ ...row, id: `${id}-${row.id}` }} priceSuffix={row.billEvery ? "/mo" : undefined} />)}</ul></div> : null}
                          {optionalCleanup.length ? <div className="mt-5 border-t border-slate-200 pt-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-700">Cleanup estimate</p><p className="mt-2 text-xs leading-5 text-slate-600">Select the periods to estimate. Cleanup is not charged today; final scope, price, and payment milestones are confirmed after discovery.</p><ul className="mt-4 space-y-7 text-sm text-slate-600">{optionalCleanup.map((row) => <ServiceLine key={row.id} row={row} selected={cleanupIsSelected(id, row.cleanupPeriodKey!)} onToggle={(checked) => setCleanupSelections((prev) => ({ ...prev, [cleanupKey(id, row.cleanupPeriodKey!)]: checked }))} showPriceWhenUnselected />)}</ul></div> : null}
                          {additionalSetup.length ? <div className="mt-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-700">Additional setup</p><ul className="mt-2 space-y-2 text-sm text-slate-600">{additionalSetup.map((row) => <ServiceLine key={row.id} row={row} />)}</ul></div> : null}
                        </div>
                      </section>

                      {/* Recurring services */}
                      <section>
                        <p className={sectionLabelClass}>Recurring services</p>
                      </section>

                      {optionalAdditionalRows.length > 0 ? (
                        <section>
                          <p className="bg-accent-100 px-5 py-3 text-xs font-bold uppercase tracking-[0.12em]" style={{ color: inkColor }}>Optional add-ons</p>
                          <div className="px-5 py-4">
                            <ul className="space-y-2 text-sm text-slate-600">
                              {optionalAdditionalRows.map((row) => (
                                <ServiceLine
                                  key={row.id}
                                  row={{ ...row, id: `${id}-${row.id}` }}
                                  selected={additionalOptionSelections[id][row.id] ?? false}
                                  onToggle={(checked) => setAdditionalOptionSelections((previous) => ({
                                    ...previous,
                                    [id]: { ...previous[id], [row.id]: checked },
                                  }))}
                                  showPriceWhenUnselected={row.price > 0}
                                  priceSuffix={row.price > 0 ? (row.billEvery ? "/mo" : " one time") : undefined}
                                />
                              ))}
                            </ul>
                          </div>
                        </section>
                      ) : <div />}

                      {/* All included services */}
                      <section>
                        <p className="bg-emerald-100 px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-emerald-900">Included with this package</p>
                        <ul className="space-y-2 pl-8 pr-5 pt-4 pb-2 text-sm text-slate-600">
                          {allIncludedRows.map((row) => renderIncludedRow(row, newAtThisTier.has(row.id)))}
                        </ul>
                      </section>

                      {/* Pricing summary */}
                      <div className="border-t border-slate-200 p-5">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Your pricing</p>
                        <div className="mt-3">
                          <ProposalPaymentPlan cleanupMonths={selectedCleanupMonths} cleanupMonthlyRate={options.maintain.monthlyPrice}
                            onboardingFee={onboardingFee} recurringMonthlyTotal={recurringTotal} additionalOneTimeTotal={additionalOneTimeTotal}
                            requiredOneTime={requiredAddOnRows.filter((row) => !row.billEvery).map((row) => ({ name: row.serviceName, price: row.price * row.quantity }))}
                            annual={hasTwelveMonthAgreement} amountDueNow={isTestProposal ? 1 : undefined}
                            annualSavingsPercent={annualSavingsPercent}
                            originalOnboardingFee={assessment.showOriginalOneTimePrices !== false && onboardingWaived ? originalOnboardingFee : undefined}
                            creditApplied={isTestProposal ? 0 : firstPaymentCredit} />
                        </div>
                        <button
                          type="button"
                          disabled={paymentStatus === "succeeded" || selectionSubmittingId !== null}
                          onClick={() => void selectOptionAndContinue(id)}
                          className={`${
                            paymentStatus === "succeeded" && !selected
                              ? "mt-4 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-400 transition disabled:cursor-not-allowed"
                              : "mt-4 w-full rounded-lg border px-4 py-3 text-base font-bold transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                          }${showMobileSelectBar ? " hidden" : ""}`}
                          style={paymentStatus === "succeeded" && !selected ? undefined : { backgroundColor: tierColors[id].background, borderColor: tierColors[id].background, color: tierColors[id].foreground }}
                        >
                          {paymentStatus === "succeeded"
                            ? (selected ? "Selected & Paid" : "Not selected")
                            : selectionSubmittingId === id ? "Saving selection…" : `Select ${option.name}`}
                        </button>
                        {urgencyOffer.active ? (
                          <p className={`mt-2 text-center text-xs font-medium text-slate-500${showMobileSelectBar ? " hidden" : ""}`}>{urgencyOffer.ctaHint}</p>
                        ) : null}
                      </div>
                    </section>
                  );
                })}
              </div>

              {/* Mobile checkout bar: what's due today for the package in view, and its Select button */}
              {showMobileSelectBar ? (
                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur">
                  <MobilePackageTabs compact className="mx-auto mb-2 max-w-2xl" options={options} activeId={activePackageId} discountMultiplier={recurringDiscountMultiplier}
                    tierColors={tierColors} inkColor={inkColor} onSelect={showPackage} />
                  <div className="mx-auto flex max-w-2xl items-center gap-3">
                    {/* Every package's label and amount share one grid cell, so the block is always as
                        wide as the widest and the button beside it never changes size. Never wraps. */}
                    <div className="grid shrink-0 whitespace-nowrap">
                      {optionMeta.map(({ id }) => (
                        <div key={id} aria-hidden={id !== activePackageId} className={`[grid-area:1/1] ${id === activePackageId ? "" : "invisible"}`}>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Due today · {options[id].name}</p>
                          <p className="text-2xl font-bold leading-tight" style={{ color: inkColor }}>{fmt(mobileDueToday[id] ?? 0)}</p>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={selectionSubmittingId !== null}
                      onClick={() => void selectOptionAndContinue(activePackageId)}
                      className="min-w-0 flex-1 truncate rounded-lg border px-3 py-3 text-base font-bold transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ backgroundColor: tierColors[activePackageId].background, borderColor: tierColors[activePackageId].background, color: tierColors[activePackageId].foreground }}
                    >
                      {selectionSubmittingId === activePackageId ? "Saving…" : (
                        // Under 360px the package name would be cut off; the tabs and due-today label already name it.
                        <>Select<span className="hidden min-[360px]:inline"> {options[activePackageId].name}</span></>
                      )}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Step 2 — Deposit / Contract */}
          {step === 2 && !alreadySigned && agreementIsOpen && (
            <div className="relative py-6">
              {editMode && onEdit ? (
                <PreviewEditButton
                  label="Edit agreement"
                  onClick={() => onEdit("agreement")}
                  className="absolute right-0 top-0 z-20"
                />
              ) : null}
              {!alreadySigned ? (
                <div className="space-y-5">
                  {urgencyOffer.active ? (
                    <ProposalUrgencyBanner offer={urgencyOffer} accentColor={actionColor} inkColor={inkColor} compact />
                  ) : null}
                  <div>
                    {selectedPaymentPlan ? <div className="mb-6 rounded-xl border border-slate-200 p-5">{selectedPaymentPlan}</div> : null}
                    <h2 className="text-sm font-bold text-slate-900">{agreementTitle}</h2>
                    <p className="mt-1 text-sm font-semibold" style={{ color: inkColor }}>
                      {isSimulation
                        ? "Complete the fields below to preview signing and payment. Nothing will be recorded."
                        : engagementId
                          ? "You must read the entire agreement below before you can sign."
                          : "Review your agreement. In a live proposal, you would sign here before paying."}
                    </p>
                    <div
                      data-proposal-surface="light"
                      ref={agreementScrollRef}
                      onScroll={(event) => checkAgreementScrolled(event.currentTarget)}
                      tabIndex={0}
                      role="region"
                      aria-label={`${agreementTitle} text, scroll to review`}
                      className="ui-focus-ring mt-2 max-h-[50vh] overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 focus:outline-none sm:max-h-[65vh]"
                      style={{ "--proposal-light-surface-ink": lightSurfaceInk } as React.CSSProperties}
                    >
                      {agreementLoading ? (
                        <p className="text-sm text-slate-500">Loading your agreement…</p>
                      ) : displayedAgreementText ? (
                        <AgreementTextView text={displayedAgreementText} />
                      ) : (
                        <p className="text-sm text-slate-500">
                          {engagementId
                            ? "Unable to load agreement text. Please refresh and try again."
                            : "No agreement template is selected."}
                        </p>
                      )}
                    </div>
                    {!agreementLoading && engagementId ? (
                      hasScrolledToEnd ? (
                        <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                          <Check className="h-4 w-4" /> You&apos;ve reached the end of the agreement.
                        </p>
                      ) : (
                        <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-amber-700">
                          <ChevronRight className="h-4 w-4 rotate-90" /> Keep reading — scroll to the end to unlock signing.
                        </p>
                      )
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700" htmlFor="signerName">
                      Type your full legal name to sign
                    </label>
                    <input
                      id="signerName"
                      data-clarity-mask="true"
                      type="text"
                      required
                      autoComplete="off"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      placeholder="Your full name"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-brandnavy focus:outline-none focus:ring-1 focus:ring-brandnavy"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700" htmlFor="signerTitle">
                      Title / Role <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <input
                      id="signerTitle"
                      data-clarity-mask="true"
                      type="text"
                      value={signerTitle}
                      onChange={(e) => setSignerTitle(e.target.value)}
                      placeholder="e.g. Owner, CFO, Authorized Representative"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-brandnavy focus:outline-none focus:ring-1 focus:ring-brandnavy"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700" htmlFor="signerEmail">Email</label>
                    <input
                      id="signerEmail"
                      data-clarity-mask="true"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@yourcompany.com"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-brandnavy focus:outline-none focus:ring-1 focus:ring-brandnavy"
                    />
                    <p className="mt-1 text-xs text-slate-500">We&apos;ll send your payment receipt here.</p>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                    <input
                      type="checkbox"
                      id="readAndAgreed"
                      checked={readAndAgreedChecked}
                      onChange={(e) => setReadAndAgreedChecked(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0"
                    />
                    <label htmlFor="readAndAgreed" className="text-xs leading-5 text-slate-600">
                      I have read this Agreement in its entirety and agree to be bound by all of its terms and conditions.
                    </label>
                  </div>
                  <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                    <input
                      type="checkbox"
                      id="consentElectronic"
                      checked={consentChecked}
                      onChange={(e) => setConsentChecked(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0"
                    />
                    <label htmlFor="consentElectronic" className="text-xs leading-5 text-slate-600">
                      I consent to sign this document electronically and understand that my electronic signature has the same legal effect as a handwritten signature.
                    </label>
                  </div>
                  {signError ? <p className="text-xs text-red-600">{signError}</p> : null}
                  <button
                    type="button"
                    disabled={!canSignAgreement || signSubmitting}
                    onClick={() => void submitSignatureAndContinue()}
                    className="ui-action-primary inline-flex w-full items-center justify-center gap-2 rounded-lg border-2 px-5 py-3 text-sm font-bold transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(15,23,42,0.22)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  >
                    {isSimulation
                      ? <>
                          {requiresOnboardingPayment ? "Preview Sign & Continue to Payment" : "Preview Sign & Continue"}
                          <ChevronRight strokeWidth={3} className="h-4 w-4" />
                        </>
                      : !engagementId
                      ? <>Continue <ChevronRight strokeWidth={3} className="h-4 w-4" /></>
                      : signSubmitting
                        ? "Submitting…"
                        : <>
                            {requiresOnboardingPayment ? "Sign & Continue to Payment" : "I Agree — Sign & Continue"}
                            <ChevronRight strokeWidth={3} className="h-4 w-4" />
                          </>}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                    Signed by <span className="font-semibold">{signedSignerName}</span>
                    {signedAt ? ` on ${new Date(signedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : null}
                  </div>
                  <div className="grid gap-6 md:grid-cols-[1fr_380px] md:items-start">
                    <div className="order-2 space-y-4 rounded-xl border border-slate-200 p-6 md:order-1">
                      {paymentClientSecret ? (
                        <DepositPaymentForm
                          clientSecret={paymentClientSecret}
                          onPaid={async (status) => {
                            await confirmStripePayment(status);
                            setStep(3);
                          }}
                        />
                      ) : signError ? (
                        <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                          <p className="text-xs text-red-700">We couldn&apos;t start the payment form: {signError} Please try again.</p>
                          <button
                            type="button"
                            disabled={signSubmitting}
                            onClick={() => void submitSignatureAndContinue()}
                            className="ui-action-danger rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                          >
                            {signSubmitting ? "Retrying…" : "Retry"}
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-600">Preparing your payment form…</p>
                      )}
                    </div>

                    <div className="order-1 space-y-4 md:order-2">
                      <div className="relative rounded-xl border border-slate-200 bg-white p-5">
                        {editMode && onEdit ? (
                          <PreviewEditButton
                            label="Edit payment pricing"
                            onClick={() => onEdit("pricing")}
                            className="absolute right-3 top-3 z-20"
                          />
                        ) : null}
                        {selectedPaymentPlan ?? <>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{chargeLabel}</p>
                        {selectedOptionId ? (
                          <p className="mt-1 text-sm text-slate-600">{options[selectedOptionId].name} package</p>
                        ) : null}
                        <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                          <span className="text-sm font-semibold text-slate-700">Total due</span>
                          <span className="text-2xl font-bold text-brandnavy">
                            {chargeAmount > 0 ? fmt(chargeAmount) : "—"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">{chargeDescription}</p>
                        </>}
                      </div>
                      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                        <p className="text-xs leading-5 text-slate-500">
                          Payments are processed securely by Stripe. Your card details are never stored on our servers.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && agreementManagerStatus === "VOIDED_BEFORE_SIGNATURE" && (
            <div className="py-10 text-center">
              <h2 className="text-lg font-semibold text-slate-900">This agreement is no longer available</h2>
              <p className="mt-2 text-sm text-slate-600">The agreement was voided before it was signed. Please contact us if you need an updated proposal.</p>
            </div>
          )}

          {step === 2 && alreadySigned && agreementIsOpen && (
            <div className="py-6">
              {signedByBanner}
              {signError ? (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <p>{signError}</p>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => void submitSignatureAndContinue()}
                disabled={signSubmitting}
                className="ui-action-primary mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border-2 px-5 py-3 text-sm font-bold transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(15,23,42,0.22)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                {signSubmitting
                  ? "Preparing payment..."
                  : paymentStatus === "succeeded"
                  ? "View Confirmation"
                  : requiresOnboardingPayment ? "Continue to Payment" : "Continue"}
                <ChevronRight strokeWidth={3} className="h-4 w-4" />
              </button>
              {signedAgreementCollapsible ? <div className="mt-4">{signedAgreementCollapsible}</div> : null}
            </div>
          )}

          {step === 2 && alreadySigned && (agreementManagerStatus === "CANCELLATION_REQUESTED" || agreementManagerStatus === "TERMINATED_AFTER_SIGNATURE") && (
            <div className="space-y-5 py-6">
              <div className={`rounded-lg border px-4 py-3 text-sm ${agreementManagerStatus === "CANCELLATION_REQUESTED" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                {agreementManagerStatus === "CANCELLATION_REQUESTED"
                  ? "The business has requested cancellation of this signed agreement. Review the request below and confirm if you agree."
                  : "This signed agreement has been terminated by mutual acknowledgment."}
              </div>
              {agreementManagerStatus === "CANCELLATION_REQUESTED" ? (
                <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
                  <h2 className="text-base font-semibold text-slate-900">Confirm agreement cancellation</h2>
                  <p className="text-sm leading-6 text-slate-600">By confirming, you acknowledge that this signed agreement will no longer govern the engagement.</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-semibold text-slate-700">Full name<input value={cancellationName} onChange={(event) => setCancellationName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-900" /></label>
                    <label className="text-sm font-semibold text-slate-700">Signer email<input type="email" value={cancellationEmail} onChange={(event) => setCancellationEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-900" /></label>
                  </div>
                  {cancellationError ? <p className="text-sm text-red-700">{cancellationError}</p> : null}
                  <button type="button" onClick={() => void acknowledgeCancellation()} disabled={cancellationSubmitting || !cancellationName.trim() || !isValidEmail(cancellationEmail)} className="ui-action-primary w-full rounded-lg border px-4 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40">
                    {cancellationSubmitting ? "Confirming…" : "Acknowledge cancellation"}
                  </button>
                </div>
              ) : null}
              {signedAgreementCollapsible ? <div>{signedAgreementCollapsible}</div> : null}
            </div>
          )}

          {/* Step 3 — Payment */}
          {step === 3 && !paymentStatus && alreadySigned && agreementIsOpen && (requiresOnboardingPayment || paymentClientSecret) && (
            <div className="py-6">
              {signedByBanner}
              {signedAgreementCollapsible ? <div className="mt-3">{signedAgreementCollapsible}</div> : null}
              <div className="mt-4 grid gap-6 md:grid-cols-[1fr_380px] md:items-start">
                <div className="order-2 space-y-4 rounded-xl border border-slate-200 p-6 md:order-1">
                  {isSimulation ? (
                    <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sky-950">
                      <p className="text-sm font-bold">Payment preview</p>
                      <p className="mt-1 text-sm leading-6 text-sky-800">
                        No payment method is collected and no charge will be created in preview mode.
                      </p>
                      <button
                        type="button"
                        onClick={() => setPaymentStatus("succeeded")}
                        className="ui-action-primary mt-4 inline-flex items-center rounded-lg border-2 px-4 py-2.5 text-sm font-bold"
                      >
                        Simulate successful payment
                      </button>
                    </div>
                  ) : paymentClientSecret ? (
                    <DepositPaymentForm
                      clientSecret={paymentClientSecret}
                      onPaid={confirmStripePayment}
                    />
                  ) : signError ? (
                    <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                      <p className="text-xs text-red-700">We couldn&apos;t start the payment form: {signError} Please try again.</p>
                      <button
                        type="button"
                        disabled={signSubmitting}
                        onClick={() => void submitSignatureAndContinue()}
                        className="ui-action-danger rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                      >
                        {signSubmitting ? "Retrying..." : "Retry"}
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600">Preparing your payment form...</p>
                  )}
                </div>
                <div className="order-1 space-y-4 md:order-2">
                  <div className="relative rounded-xl border border-slate-200 bg-white p-5">
                    {editMode && onEdit ? (
                      <PreviewEditButton
                        label="Edit payment pricing"
                        onClick={() => onEdit("pricing")}
                        className="absolute right-3 top-3 z-20"
                      />
                    ) : null}
                    {selectedPaymentPlan ?? <>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{chargeLabel}</p>
                    {selectedOptionId ? <p className="mt-1 text-sm text-slate-600">{options[selectedOptionId].name} package</p> : null}
                    <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                      <span className="text-sm font-semibold text-slate-700">Total due</span>
                      <span className="text-2xl font-bold text-brandnavy">
                        {chargeAmount > 0 ? fmt(chargeAmount) : "—"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{chargeDescription}</p>
                    </>}
                  </div>
                  <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                    <p className="text-xs leading-5 text-slate-500">Payments are processed securely by Stripe. Your card details are never stored on our servers.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && !paymentStatus && !paymentClientSecret && (!alreadySigned || !requiresOnboardingPayment) && (
            <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
              {!alreadySigned ? (
                <>
                  <h1 className="text-2xl font-bold text-slate-900">Complete the agreement first</h1>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Once the agreement is signed, you&apos;ll be able to review and complete payment here.
                  </p>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="ui-action-primary mt-6 inline-flex items-center rounded-lg border-2 px-5 py-2.5 text-sm font-bold transition-all"
                    style={stepperPrimaryVariables}
                  >
                    Return to Agreement
                  </button>
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-bold text-slate-900">No payment is required</h1>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Your agreement is complete. You can continue without making a payment.
                  </p>
                  <button
                    type="button"
                    onClick={() => setPaymentStatus("succeeded")}
                    className="ui-action-primary mt-6 inline-flex items-center rounded-lg border-2 px-5 py-2.5 text-sm font-bold transition-all"
                    style={stepperPrimaryVariables}
                  >
                    Continue
                  </button>
                </>
              )}
            </div>
          )}

          {/* Step 3 — Confirmation */}
          {step === 3 && paymentStatus && (
            <div className="mx-auto grid max-w-2xl place-items-center px-7 py-20 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                <BadgeCheck className="h-8 w-8" />
              </div>
              {paymentStatus === "processing" ? (
                <>
                  <h1 className="mt-6 text-3xl font-bold">Your payment is processing</h1>
                  <p className="mt-3 text-slate-600">
                    {contractFollowsPayment ? "Your proposal is accepted." : "Your agreement is signed."} Your payment was submitted and is being confirmed.
                    We&apos;ll email a receipt to {email || "the email you provided"} once it&apos;s confirmed.{" "}
                    {contractFollowsPayment
                      ? `Within 24 hours you'll receive your service agreement from ${brand.name} through QuickBooks. Please sign it as soon as you can — we start work once it's signed.`
                      : "We'll be in touch to kick off onboarding."}
                  </p>
                </>
              ) : (
                <>
                  <h1 className="mt-6 text-3xl font-bold">
                    You&apos;re all set
                  </h1>
                  <p className="mt-3 text-slate-600">
                    {isSimulation
                      ? "Preview complete — nothing was signed, charged, or recorded."
                      : engagementId
                      ? `${contractFollowsPayment ? "Your proposal is accepted" : "Your agreement is signed"} and ${paymentWaived ? "no initial payment is due" : stagedPayment && hasCleanup ? "your onboarding and discovery payment is complete" : chargeIsFirstMonth ? "your first month is paid" : "your initial payment is complete"}. ${contractFollowsPayment ? `Within 24 hours you'll receive your service agreement from ${brand.name} through QuickBooks. Please sign it as soon as you can — we start work once it's signed.` : "We'll be in touch shortly to kick off onboarding."}`
                      : "We have your selection and will be in touch to kick off onboarding. Reach out any time if you have questions."}
                  </p>
                </>
              )}
              <p className="mt-4 text-sm font-semibold text-slate-700">{brand.name}</p>
              {stagedPayment && hasCleanup ? <p className="mt-4 text-sm leading-6 text-slate-600">Next, provide access and records for discovery. We will confirm the cleanup scope, price, and payment milestones for your approval before starting cleanup.</p> : null}
            </div>
          )}

        </article>
      </section>

      {/* Comparison modal */}
      {comparisonOpen ? (
        <Modal onClose={() => setComparisonOpen(false)} labelledBy="comparison-title" className="max-w-[1180px] overflow-hidden">
          <div className="flex max-h-[calc(100dvh-1rem)] min-h-0 flex-col sm:max-h-[calc(100dvh-2rem)]">
            <header className="flex items-start justify-between gap-6 border-b border-slate-200 px-5 py-4 sm:px-7">
              <div>
                <h2 id="comparison-title" className="text-2xl font-bold" style={{ color: inkColor }}>Compare everything included</h2>
                <p className="mt-1 text-sm text-slate-600">Review pricing, services, and support details across all three options.</p>
              </div>
              <button type="button" onClick={() => setComparisonOpen(false)} aria-label="Close plan comparison" className="ui-action-ghost rounded-lg p-2 transition">
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto">
              <table className="w-full table-fixed border-collapse text-sm">
                <colgroup><col /><col className="w-28" /><col className="w-28" /><col className="w-28" /></colgroup>
                <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_#e2e8f0]">
                  <tr>
                    <th scope="col" className="px-5 py-4 text-left text-sm font-semibold normal-case text-slate-700">Service and Feature</th>
                    {optionMeta.map(({ id }) => (
                      <th scope="col" key={id} className="px-2 py-4 text-center align-top text-sm font-semibold normal-case text-slate-700">
                        <p>{options[id].name}</p>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ backgroundColor: subtleAccentBg }}><th colSpan={4} className="px-5 py-2.5 text-left text-xs font-bold uppercase tracking-wide" style={{ color: inkColor }}>One-time services</th></tr>
                  {oneTimeServiceNames.map((name, i) => {
                    const ref = optionMeta.map(({ id }) => options[id].oneTimeRows.find((r) => r.serviceName === name)).find(Boolean);
                    return (
                      <tr key={name} className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                        <th scope="row" className="px-5 py-3 text-left align-top font-semibold" style={{ color: inkColor }}>
                          {name}
                          {ref ? <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">{getTooltip(ref)}</span> : null}
                        </th>
                        {optionMeta.map(({ id }) => {
                          const row = options[id].oneTimeRows.find((r) => r.serviceName === name);
                          return <td key={id} className="px-4 py-3 text-center align-middle">{row ? <Check aria-label="Included" className="mx-auto h-5 w-5" style={{ color: inkColor }} /> : <span className="text-slate-300">—</span>}</td>;
                        })}
                      </tr>
                    );
                  })}
                  <tr style={{ backgroundColor: brandDark, color: brandDarkForeground }}><th colSpan={4} className="px-5 py-2.5 text-left text-xs font-bold uppercase tracking-wide">Recurring services</th></tr>
                  {recurringServiceNames.map((name, i) => {
                    const ref = optionMeta.map(({ id }) => options[id].recurringRows.find((r) => r.serviceName === name)).find(Boolean);
                    return (
                      <tr key={name} className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                        <th scope="row" className="px-5 py-3 text-left align-top font-semibold" style={{ color: inkColor }}>
                          {name}
                          {ref ? <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">{getTooltip(ref)}</span> : null}
                        </th>
                        {optionMeta.map(({ id }) => {
                          const row = options[id].recurringRows.find((r) => r.serviceName === name);
                          return <td key={id} className="px-4 py-3 text-center align-middle">{row ? <Check aria-label="Included" className="mx-auto h-5 w-5" style={{ color: inkColor }} /> : <span className="text-slate-300">—</span>}</td>;
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      ) : null}
    </main>
  );
}

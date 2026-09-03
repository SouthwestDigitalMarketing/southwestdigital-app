"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Check,
  ChevronRight,
  CircleHelp,
  LineChart,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
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
import { extraIsRealEstateSpecific } from "@/lib/quotes/catalog";
import { ProposalReviewsSection } from "./ProposalReviewsSection";
import AgreementTextView from "./AgreementTextView";
import DepositPaymentForm from "./DepositPaymentForm";
import PaypalPaymentButton from "./PaypalPaymentButton";
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
  type AssessmentState,
  type HistoricalCleanupPeriod,
} from "./ProposalCreationWorkspaceDemo";
import {
  DEFAULT_HERO_CONTINUE_BUTTON,
  DEFAULT_HERO_MEDIA_BUTTON,
  HeroCtaContent,
  normalizeHeroButton,
} from "./heroButtons";
import { resolveCoverMedia } from "./coverMedia";
import { DEFAULT_URGENCY_OFFER, getUrgencyOfferDisplay } from "./urgencyOffer";
import { ProposalUrgencyBanner, ProposalUrgencyNote } from "./ProposalUrgencyBanner";
import {
  DEFAULT_AGREEMENT_TEMPLATE_NAME,
  DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE,
  renderAgreementTemplate,
} from "@/lib/agreements/template";
import type { AgreementTemplateOption } from "@/lib/agreements/types";

type CloudflareStreamEvent = "play" | "pause" | "ended";

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
  platformTag?: "QBO" | "Stessa";
};

type ProposalOption = {
  id: OptionId;
  name: string;
  monthlyPrice: number;
  recurringRows: ServiceRow[];
  oneTimeRows: ServiceRow[];
};

// ─── Static data ──────────────────────────────────────────────────────────────

function isOnboardingFeeWaived(assessment: AssessmentState) {
  return assessment.waiveOnboardingFee || assessment.onboardingFeeOverride === 0;
}

function getOnboardingFee(assessment: AssessmentState, cleanupMonths: number) {
  if (assessment.waiveOnboardingFee) return 0;
  if (assessment.onboardingFeeOverride !== null) return Math.max(0, assessment.onboardingFeeOverride);
  return getStandardOnboardingFee(cleanupMonths);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

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

function fmt(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function platformLabel(platform: HistoricalCleanupPeriod["platform"] | AssessmentState["ongoingBookkeepingPlatform"]) {
  return platform === "stessa" ? "Stessa" : "QuickBooks Online";
}

function getTooltip(row: ServiceRow) {
  return row.note ?? `Details about ${row.serviceName}.`;
}

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
      const platform = platformLabel(period.platform ?? "qbo");
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

function buildOptions(assessment: AssessmentState): Record<OptionId, ProposalOption> {
  const { packagePricing } = getProposalPricingSnapshotData(assessment);
  const periods = hasCatchUpPricingInputs(assessment)
    ? assessment.historicalCleanupPeriods.filter((p) => periodMonthCount(p) > 0)
    : [];
  const maintainMonthly = packagePricing.maintain.monthly;

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

    const legacyBonusIncluded = (bonusId: string) => ({
      "stessa-migration": assessment.includeConditionalStessaMigration,
      "property-reporting-setup": assessment.includePropertyLevelReportingSetup,
      "document-organization": assessment.includeDocumentOrganizationSetup,
      "quarterly-review": assessment.includeQuarterlyFinancialReview,
      "doublehq-client-portal": assessment.includeDoubleHqClientPortal,
      "real-estate-chart-of-accounts": assessment.includeRealEstateChartOfAccounts,
      "new-quickbooks-file": assessment.includeNewQuickBooksFileSetup,
    } as Record<string, boolean>)[bonusId] ?? false;
    const eligibleBonuses = getProposalBonuses(assessment)
      .filter((bonus) => !bonus.archived)
      .filter((bonus) => bonus.applicable !== false)
      .filter((bonus) => {
        const realEstate = assessment.bookSetType === "real-estate-only" || assessment.bookSetType === "mixed-books";
        if (bonus.id === "stessa-migration") return assessment.platformMigrationEnabled && assessment.ongoingBookkeepingPlatform === "stessa";
        if (!extraIsRealEstateSpecific(bonus, [])) return true;
        if (bonus.id === "new-quickbooks-file") return realEstate && assessment.ongoingBookkeepingPlatform === "qbo";
        return realEstate;
      })
      .filter((bonus) => {
        const selectedPackages = assessment.bonusPackageSelections[bonus.id];
        if (Array.isArray(selectedPackages)) return selectedPackages.includes(id);
        if (bonus.defaultPackageIds) return bonus.defaultPackageIds.includes(id);
        return legacyBonusIncluded(bonus.id);
      });

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
      monthlyPrice: packagePricing[id].monthly,
      recurringRows: recurringBonuses.map((row) =>
        row.serviceName === "Monthly Bookkeeping"
          ? {
              ...row,
              platformTag: assessment.ongoingBookkeepingPlatform === "stessa" ? "Stessa" as const : "QBO" as const,
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
      <button type="button" aria-label={`More information about ${row.serviceName}`} className="text-slate-400 hover:text-brandnavy focus:text-brandnavy focus:outline-none">
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function OfferProposalPreview({
  initialAssessment,
  initialContactInfo,
  live = false,
  embedded = false,
  assessment: assessmentOverride,
  catalogOffer = null,
  engagementId: engagementIdProp = null,
  agreementTemplate = null,
}: {
  initialAssessment?: Partial<AssessmentState>;
  initialContactInfo?: Partial<ContactInfoState>;
  live?: boolean;
  embedded?: boolean;
  assessment?: AssessmentState;
  issuedAt?: Date | string | null;
  catalogOffer?: ReturnType<typeof getUrgencyOfferDisplay> | null;
  engagementId?: string | null;
  agreementTemplate?: AgreementTemplateOption | null;
} = {}) {
  const { brand } = useBrand();
  const { assessment: storedAssessment } = useProposalAssessmentDemoState({
    initialAssessment,
    persist: !live && !assessmentOverride,
  });
  const assessment = assessmentOverride ?? storedAssessment;
  const { contactInfo } = useProposalContactInfoDemoState({ initialContactInfo, persist: !live });
  const searchParams = useSearchParams();
  const engagementId = engagementIdProp ?? searchParams.get("engagementId");

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

  const options = buildOptions(assessment);
  const [selectedOptionId, setSelectedOptionId] = useState<OptionId | null>(null);
  const [selectionSubmittingId, setSelectionSubmittingId] = useState<OptionId | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [hasStartedIntroVideo, setHasStartedIntroVideo] = useState(false);
  const [isIntroVideoPlaying, setIsIntroVideoPlaying] = useState(false);
  const [introVideoError, setIntroVideoError] = useState<string | null>(null);
  const [streamSdkReady, setStreamSdkReady] = useState(false);
  const [hasTwelveMonthAgreement, setHasTwelveMonthAgreement] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [cleanupSelections, setCleanupSelections] = useState<Record<string, boolean>>({});
  const [additionalOptionSelections, setAdditionalOptionSelections] = useState<Record<OptionId, Record<string, boolean>>>({ grow: {}, improve: {}, maintain: {} });

  // Signing / payment state
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const [email, setEmail] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [readAndAgreedChecked, setReadAndAgreedChecked] = useState(false);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [signedSignerName, setSignedSignerName] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [signSubmitting, setSignSubmitting] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"succeeded" | "processing" | null>(null);
  const [agreementText, setAgreementText] = useState("");
  const [agreementLoading, setAgreementLoading] = useState(Boolean(engagementId));
  const agreementScrollRef = useRef<HTMLDivElement>(null);
  const streamIframeRef = useRef<HTMLIFrameElement>(null);
  const streamPlayerRef = useRef<CloudflareStreamPlayer | null>(null);
  const playRequestedRef = useRef(false);
  const coverMedia = resolveCoverMedia(
    {
      featuredMediaId: assessment.featuredMediaId,
      featuredVideoUrl: assessment.featuredVideoUrl,
      featuredImageUrl: assessment.featuredImageUrl,
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
  }, [introEmbedUrl, streamSdkReady]);

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
    fetch(`/api/proposal/${engagementId}/agreement`)
      .then((r) => r.json())
      .then((result: { text?: string; signed?: boolean; signerName?: string | null; signedAt?: string | null }) => {
        setAgreementText(result.text ?? "");
        if (result.signed) {
          setAlreadySigned(true);
          setSignedSignerName(result.signerName ?? null);
          setSignedAt(result.signedAt ?? null);
          if (!assessment.waiveOnboardingFee && assessment.onboardingFeeOverride !== 0) {
            fetch(`/api/proposal/${engagementId}/payment-intent`, { method: "POST" })
              .then((r) => r.json())
              .then((pr: { clientSecret?: string }) => { if (pr.clientSecret) setPaymentClientSecret(pr.clientSecret); })
              .catch(() => {});
          }
        }
      })
      .catch(() => {})
      .finally(() => setAgreementLoading(false));
  }, [step, engagementId, assessment.waiveOnboardingFee, assessment.onboardingFeeOverride]);

  function checkAgreementScrolled(el: HTMLDivElement) {
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) setHasScrolledToEnd(true);
  }

  function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  const canSignAgreement = signerName.trim().length > 0 && isValidEmail(email) && consentChecked && readAndAgreedChecked && hasScrolledToEnd;

  async function selectOptionAndContinue(id: OptionId) {
    const option = options[id];
    setSelectionError(null);

    if (!engagementId) {
      setSelectedOptionId(id);
      setStep(2);
      return;
    }

    setSelectionSubmittingId(id);
    try {
      const onboardingFee = option.oneTimeRows.find((row) => isOnboarding(row))?.price ?? 0;
      const response = await fetch(`/api/proposal/${engagementId}/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: id,
          tierLabel: option.name,
          onboardingFee,
          recurringMonthlyTotal: option.monthlyPrice,
        }),
      });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(result?.error ?? "We couldn't save your service selection. Please try again.");
      }

      setSelectedOptionId(id);
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
    if (!engagementId) { setStep(3); return; }
    setSignSubmitting(true);
    setSignError(null);
    try {
      if (!alreadySigned) {
        const response = await fetch(`/api/proposal/${engagementId}/sign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
      if (selectedOnboardingFee === 0) {
        setPaymentStatus("succeeded");
        setStep(3);
        return;
      }
      const paymentResponse = await fetch(`/api/proposal/${engagementId}/payment-intent`, { method: "POST" });
      const paymentResult = await paymentResponse.json().catch(() => null) as { clientSecret?: string; error?: string } | null;
      if (!paymentResponse.ok || !paymentResult?.clientSecret) {
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
  const annualSavingsPercent = getAnnualSavingsPercent(assessment);
  const recurringDiscountMultiplier = hasTwelveMonthAgreement
    ? 1 - annualSavingsPercent / 100
    : 1;

  const cleanupPeriods = hasCatchUpPricingInputs(assessment)
    ? assessment.historicalCleanupPeriods
      .filter((p) => periodMonthCount(p) > 0)
      .sort((a, b) => (a.year * 12 + a.startMonth) - (b.year * 12 + b.startMonth))
    : [];

  const cleanupKey = (optionId: OptionId, periodKey: string) => `${optionId}:${periodKey}`;
  const cleanupIsSelected = (optionId: OptionId, periodKey: string) => cleanupSelections[cleanupKey(optionId, periodKey)] !== false;

  const additionalOptionRows = getProposalAdditionalOptions(assessment)
    .filter((option) => option.applicable !== false && option.showInProposal && !option.archived && option.name.trim())
    .map((option): ServiceRow => ({
      id: option.id,
      serviceName: option.name,
      billStart: "On Acceptance",
      billEnd: "Until Cancelled",
      billEvery: "1 Month",
      invoiceType: "Automatic",
      priceType: "Fixed",
      quantity: 1,
      price: option.monthlyPrice,
      note: option.description,
    }));

  const recurringServiceNames = Array.from(new Set(optionMeta.flatMap(({ id }) => options[id].recurringRows.map((r) => r.serviceName))));
  const oneTimeServiceNames   = Array.from(new Set(optionMeta.flatMap(({ id }) => options[id].oneTimeRows.map((r) => r.serviceName))));

  const selectedOnboardingFee = selectedOptionId
    ? (options[selectedOptionId].oneTimeRows.find((r) => isOnboarding(r))?.price ?? null)
    : null;
  const requiresOnboardingPayment = selectedOnboardingFee !== 0;
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
      hasCleanup: cleanupPeriods.length > 0,
    },
  );
  const displayedAgreementText = engagementId ? agreementText : embeddedAgreementText;

  return (
    <main
      data-theme={proposalMode}
      data-appearance="standard"
      className={`relative isolate overflow-hidden px-4 py-6 text-brandnavy [&_button:not(:disabled)]:cursor-pointer [&_button:disabled]:cursor-not-allowed sm:px-6 lg:px-10 ${
        embedded ? "min-h-[40rem]" : "min-h-screen"
      }`}
      style={{
        background: pageBg,
        "--brand-light": lightColor,
        "--brand-accent": accentColor,
        ...primaryActionVariables,
        ...overlayVariables,
        ...darkSurfaceOverrides,
        "--brand-dark": brandDark,
        "--brand-ink": inkColor,
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
          className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
        >
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
            {step === 0 ? <span className="w-[74px]" /> : (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="ui-action-secondary rounded-lg border px-5 py-2.5 text-sm font-semibold transition"
                style={stepperSecondaryVariables}
              >
                Back
              </button>
            )}
            <ol className="flex items-start justify-center">
              {clientSteps.map((label, index) => (
                <li key={label} className="flex items-start">
                  {index > 0 && <span className="mt-4 h-0.5 w-5 sm:w-10" style={{ backgroundColor: index <= step ? brandDark : "#cbd5e1" }} />}
                  <div className="w-16 text-center sm:w-20">
                    <span
                      className={`mx-auto grid h-8 w-8 place-items-center rounded-full border text-sm font-bold ${index <= step ? "" : "border-slate-300 bg-white text-slate-500"}`}
                      style={index <= step ? { backgroundColor: lightSurfaceInk, borderColor: lightSurfaceInk, color: readableForegroundColor(lightSurfaceInk) } : undefined}
                    >
                      {index < step ? "✓" : index + 1}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">{label}</span>
                  </div>
                </li>
              ))}
            </ol>
            {step === 0 ? <span className="w-20" /> : step === 1 ? (
              <button
                type="button"
                disabled={!selectedOptionId}
                onClick={() => setStep(2)}
                className="ui-action-primary inline-flex items-center gap-2 rounded-lg border-2 px-5 py-2 text-sm font-bold transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(15,23,42,0.22)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                style={stepperPrimaryVariables}
              >
                Next <ChevronRight strokeWidth={3} className="h-4 w-4" />
              </button>
            ) : step === 2 && alreadySigned ? (
              <button
                type="button"
                disabled={requiresOnboardingPayment && !paymentClientSecret}
                onClick={() => setStep(3)}
                className="ui-action-primary inline-flex items-center gap-2 rounded-lg border-2 px-5 py-2 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40"
                style={stepperPrimaryVariables}
              >
                Continue to Payment <ChevronRight strokeWidth={3} className="h-4 w-4" />
              </button>
            ) : step === 2 && !(paymentClientSecret || alreadySigned) ? (
              <button
                type="button"
                disabled={!alreadySigned && (!canSignAgreement || signSubmitting)}
                onClick={() => void submitSignatureAndContinue()}
                className="ui-action-primary inline-flex items-center gap-2 rounded-lg border-2 px-5 py-2 text-sm font-bold transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(15,23,42,0.22)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                {!engagementId
                  ? <>Continue <ChevronRight strokeWidth={3} className="h-4 w-4" /></>
                  : signSubmitting
                    ? "Submitting…"
                    : alreadySigned
                      ? <>Continue to Payment <ChevronRight strokeWidth={3} className="h-4 w-4" /></>
                      : <>
                          {requiresOnboardingPayment ? "Sign & Continue to Payment" : "I Agree — Sign & Continue"}
                          <ChevronRight strokeWidth={3} className="h-4 w-4" />
                        </>}
              </button>
            ) : <span className="w-20" />}
          </div>
        </nav>

        <article className="space-y-8 bg-transparent">

          {/* Header (cover + deposit only) */}
          {(step === 0 || step === 2) ? (
            <header className="flex flex-wrap items-center justify-between gap-4">
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
              <div className="pb-12 sm:pb-16">
                <div className={`grid items-center gap-8 ${hasMedia ? "md:grid-cols-2" : ""}`}>
                  <div>
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
                      <div className="aspect-video">
                        {isCloudflareStreamEmbed(embedUrl) && !streamSdkReady ? (
                          <div className="grid h-full place-items-center bg-slate-100 text-sm font-medium text-slate-500">Loading video…</div>
                        ) : (
                          <iframe
                            ref={streamIframeRef}
                            src={embedUrl}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="h-full w-full"
                          />
                        )}
                      </div>
                    </div>
                  ) : imageUrl ? (
                    <div
                      className="relative overflow-hidden rounded-xl border shadow-sm"
                      style={{ borderColor: "#cbd5e1" }}
                    >
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
            <div>
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

              {/* Annual toggle */}
              <div className="mb-8 flex flex-wrap items-center justify-center gap-4 text-base font-bold sm:text-lg">
                <span className={hasTwelveMonthAgreement ? "text-slate-400" : undefined} style={hasTwelveMonthAgreement ? undefined : { color: inkColor }}>Month-to-month</span>
                <button type="button" role="switch" aria-checked={hasTwelveMonthAgreement} onClick={() => setHasTwelveMonthAgreement((v) => !v)} className={`relative h-9 w-16 rounded-full transition ${hasTwelveMonthAgreement ? "" : "bg-slate-300"}`} style={hasTwelveMonthAgreement ? { backgroundColor: brandDark } : undefined}>
                  <span className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow-sm transition ${hasTwelveMonthAgreement ? "left-8" : "left-1"}`} />
                  <span className="sr-only">
                    {annualSavingsPercent > 0
                      ? `Save ${annualSavingsPercent}% with a 12-month agreement`
                      : "Choose a 12-month agreement"}
                  </span>
                </button>
                <button type="button" aria-pressed={hasTwelveMonthAgreement} onClick={() => setHasTwelveMonthAgreement(true)} className={`inline-flex items-center gap-1.5 rounded-lg border bg-accent-100 px-3 py-1.5 transition hover:brightness-95 ${hasTwelveMonthAgreement ? "" : "border-transparent"}`} style={{ color: inkColor, borderColor: hasTwelveMonthAgreement ? brandDark : undefined }}>
                  <Sparkles className="h-5 w-5" />
                  {annualSavingsPercent > 0 ? `Annual · Save ${annualSavingsPercent}%` : "Annual"}
                  <Sparkles className="h-4 w-4" />
                </button>
              </div>

              {/* Package cards */}
              <div className="grid items-stretch gap-5 [grid-template-rows:repeat(7,auto)] lg:grid-cols-3">
                {optionMeta.map(({ id, serviceLevel }) => {
                  const option = options[id];
                  const selected = selectedOptionId === id;

                  const selectedCleanupMonths = cleanupPeriods.reduce(
                    (t, p) => t + (cleanupIsSelected(id, `${p.year}-${p.startMonth}-${p.endMonth}`) ? periodMonthCount(p) : 0),
                    0,
                  );

                  const effectiveOneTimeRows = option.oneTimeRows.map((row) =>
                    isOnboarding(row)
                      ? { ...row, price: getOnboardingFee(assessment, selectedCleanupMonths) }
                      : row,
                  );
                  const displayedOneTimeRows = effectiveOneTimeRows.filter(
                    (row) => !row.cleanupPeriodKey || cleanupIsSelected(id, row.cleanupPeriodKey),
                  );

                  const recurringTotal =
                    option.monthlyPrice * recurringDiscountMultiplier +
                    additionalOptionRows.reduce(
                      (total, row) => total + (additionalOptionSelections[id][row.id] ? row.price : 0),
                      0,
                    );

                  const onboardingWaived = isOnboardingFeeWaived(assessment);
                  const originalOnboardingFee = getListedOnboardingFee(assessment, selectedCleanupMonths);
                  const oneTimeTotal = sectionTotal(displayedOneTimeRows);
                  const originalOneTimeTotal = onboardingWaived ? oneTimeTotal + originalOnboardingFee : oneTimeTotal;
                  const paidOneTime      = effectiveOneTimeRows.filter((r) => r.price > 0);
                  const optionalCleanup  = paidOneTime.filter((r) => r.cleanupPeriodKey);
                  const requiredOnboard  = effectiveOneTimeRows.filter((r) => !r.cleanupPeriodKey && isOnboarding(r) && (r.price > 0 || onboardingWaived));
                  const additionalSetup  = paidOneTime.filter((r) => !r.cleanupPeriodKey && !isOnboarding(r));
                  const zeroPriceRows    = option.oneTimeRows.filter((r) => r.price === 0 && !isOnboarding(r));

                  const lowerTierId: OptionId | null = id === "grow" ? "improve" : id === "improve" ? "maintain" : null;
                  const lowerTierName = lowerTierId ? options[lowerTierId].name : null;
                  const lowerTierRecurring = new Set(lowerTierId ? options[lowerTierId].recurringRows.map((r) => r.serviceName) : []);
                  const currentRecurring = new Set(option.recurringRows.map((row) => row.serviceName));
                  const inheritsLowerTierRecurring = lowerTierId !== null && options[lowerTierId].recurringRows
                    .filter((row) => !row.serviceName.endsWith("Client Support"))
                    .every((row) => currentRecurring.has(row.serviceName));
                  const recurringLeadInName = inheritsLowerTierRecurring ? lowerTierName : null;
                  const isNew = (name: string) => inheritsLowerTierRecurring && !lowerTierRecurring.has(name);
                  const lowerTierZero = new Set(lowerTierId ? options[lowerTierId].oneTimeRows.filter((r) => r.price === 0).map((r) => r.serviceName) : []);
                  const currentZero = new Set(zeroPriceRows.map((row) => row.serviceName));
                  const inheritsLowerTierBonuses = lowerTierId !== null && [...lowerTierZero].every((name) => currentZero.has(name));
                  const bonusLeadInName = inheritsLowerTierBonuses ? lowerTierName : null;
                  const displayedBonuses = inheritsLowerTierBonuses
                    ? zeroPriceRows.filter((r) => !lowerTierZero.has(r.serviceName))
                    : zeroPriceRows;

                  const bkRow      = option.recurringRows.find((r) => r.serviceName === "Monthly Bookkeeping");
                  const supportRow = option.recurringRows.find((r) => r.serviceName.endsWith("Client Support"));
                  const otherRecurring = option.recurringRows.filter((r) => r.serviceName !== "Monthly Bookkeeping" && !r.serviceName.endsWith("Client Support"));
                  const orderedRecurring = inheritsLowerTierRecurring
                    ? otherRecurring.filter((r) => isNew(r.serviceName))
                    : otherRecurring;

                  return (
                    <section key={id} className="grid grid-rows-subgrid row-span-7 overflow-hidden rounded-xl border bg-white shadow-sm transition-colors" style={{ borderColor: selected ? brandDark : "#e2e8f0" }}>
                      {/* Card header */}
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h2 className="text-2xl font-bold" style={{ color: inkColor }}>{option.name}</h2>
                            <button type="button" onClick={() => setComparisonOpen(true)} className="mt-1 hidden text-xs font-semibold underline underline-offset-2" style={{ color: inkColor }}>
                              See everything included
                            </button>
                          </div>
                          <div className="space-y-1 text-right text-sm">
                            <p>
                              {onboardingWaived && originalOnboardingFee > 0 ? (
                                <span className="mr-1.5 text-slate-400 line-through">{fmt(originalOneTimeTotal)}</span>
                              ) : null}
                              <span className="font-bold" style={{ color: inkColor }}>{fmt(oneTimeTotal)}</span> <span className="text-slate-500">One-Time</span>
                            </p>
                            {onboardingWaived ? (
                              <p className="text-xs font-semibold text-emerald-700">Onboarding fee waived</p>
                            ) : null}
                            <p><span className={`font-bold ${hasTwelveMonthAgreement ? "rounded bg-accent-100 px-1.5 py-0.5" : ""}`} style={{ color: inkColor }}>{fmt(recurringTotal)}</span> <span className="text-slate-500">/mo</span></p>
                          </div>
                        </div>
                        <p className="mt-4 text-center text-xs font-bold uppercase tracking-[0.12em] text-slate-700">{serviceLevel} service level</p>
                        <button
                          type="button"
                          disabled={selectionSubmittingId !== null}
                          onClick={() => void selectOptionAndContinue(id)}
                          aria-pressed={selected}
                          className="ui-action-primary mt-4 w-full rounded-lg border px-4 py-3 text-base font-bold transition disabled:cursor-wait disabled:opacity-60"
                        >
                          {selectionSubmittingId === id ? "Saving selection…" : `Select ${option.name}`}
                        </button>
                      </div>

                      {/* One-time services */}
                      <section className="border-t border-slate-200">
                        <p className="px-5 py-3 text-xs font-bold uppercase tracking-[0.12em]" style={{ backgroundColor: subtleAccentBg, color: inkColor }}>One-time services</p>
                        <div className="px-5 py-4">
                          {requiredOnboard.length ? <div className="mt-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-700">Required to get started</p><ul className="mt-2 space-y-2 text-sm text-slate-600">{requiredOnboard.map((row) => <ServiceLine key={row.id} row={row} originalPrice={onboardingWaived && isOnboarding(row) ? originalOnboardingFee : undefined} waivedLabel={onboardingWaived && isOnboarding(row) ? "Waived" : undefined} />)}</ul></div> : null}
                          {optionalCleanup.length ? <div className="mt-5 border-t border-slate-200 pt-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-700">Optional catch-up</p><ul className="mt-4 space-y-7 text-sm text-slate-600">{optionalCleanup.map((row) => <ServiceLine key={row.id} row={row} selected={cleanupIsSelected(id, row.cleanupPeriodKey!)} onToggle={(checked) => setCleanupSelections((prev) => ({ ...prev, [cleanupKey(id, row.cleanupPeriodKey!)]: checked }))} showPriceWhenUnselected />)}</ul></div> : null}
                          {additionalSetup.length ? <div className="mt-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-700">Additional setup</p><ul className="mt-2 space-y-2 text-sm text-slate-600">{additionalSetup.map((row) => <ServiceLine key={row.id} row={row} />)}</ul></div> : null}
                        </div>
                      </section>

                      {/* Recurring services */}
                      <section>
                        <p className="px-5 py-3 text-xs font-bold uppercase tracking-[0.12em]" style={{ backgroundColor: brandDark, color: brandDarkForeground }}>Recurring services</p>
                        {bkRow && !lowerTierId ? <div className="px-5 pt-4"><p className="text-sm font-semibold text-slate-700">Monthly Bookkeeping</p><p className="mt-1 text-sm leading-6 text-slate-600">{getTooltip(bkRow)}</p></div> : null}
                        {recurringLeadInName ? <p className="px-5 pt-4 text-sm font-semibold text-slate-700">Everything in {recurringLeadInName}, plus:</p> : null}
                        <ul className="space-y-2 pl-8 pr-5 pt-4 pb-2 text-sm text-slate-600">
                          {orderedRecurring.map((row) => (
                            <li key={row.id} className={`flex justify-between gap-3 ${isNew(row.serviceName) ? "font-semibold text-emerald-700" : ""}`}>
                              <span className="inline-flex items-start gap-1.5">
                                <span className="group relative inline-flex shrink-0">
                                  <button type="button" aria-label={`More information about ${row.serviceName}`} className={`${isNew(row.serviceName) ? "text-emerald-600" : "text-slate-400"} hover:text-brandnavy focus:text-brandnavy focus:outline-none`}><CircleHelp className="h-3.5 w-3.5" /></button>
                                  <span role="tooltip" className="ui-tooltip pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-64 rounded-lg px-3 py-2 text-left text-xs font-normal leading-5 shadow-lg group-hover:block group-focus-within:block">{getTooltip(row)}</span>
                                </span>
                                <span>{row.serviceName}</span>
                                {row.platformTag ? <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isNew(row.serviceName) ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-brandnavy"}`}>{row.platformTag}</span> : null}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </section>

                      {/* Support row */}
                      {supportRow ? <div className="border-t border-slate-200 px-5 py-4"><p className="text-sm font-semibold text-slate-700">{supportRow.serviceName}</p><p className="mt-1 text-sm leading-6 text-slate-600">{getTooltip(supportRow)}</p></div> : <div />}

                      {additionalOptionRows.length > 0 ? (
                        <section>
                          <p className="bg-accent-100 px-5 py-3 text-xs font-bold uppercase tracking-[0.12em]" style={{ color: inkColor }}>Additional options</p>
                          <div className="px-5 py-4">
                            <ul className="space-y-2 text-sm text-slate-600">
                              {additionalOptionRows.map((row) => (
                                <ServiceLine
                                  key={row.id}
                                  row={{ ...row, id: `${id}-${row.id}` }}
                                  selected={additionalOptionSelections[id][row.id] ?? false}
                                  onToggle={(checked) => setAdditionalOptionSelections((previous) => ({
                                    ...previous,
                                    [id]: { ...previous[id], [row.id]: checked },
                                  }))}
                                  showPriceWhenUnselected={row.price > 0}
                                  priceSuffix={row.price > 0 ? "/mo" : undefined}
                                />
                              ))}
                            </ul>
                          </div>
                        </section>
                      ) : null}

                      {/* Bonuses */}
                      {displayedBonuses.length > 0 ? (
                        <section>
                          <p className="bg-emerald-100 px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-emerald-900">Included bonuses</p>
                          {bonusLeadInName ? <p className="px-5 pt-4 text-sm font-semibold text-slate-700">Everything in {bonusLeadInName}, plus:</p> : null}
                          <ul className="space-y-2 pl-8 pr-5 pt-4 pb-2 text-sm text-slate-600">
                            {displayedBonuses.map((row) => (
                              <li key={row.id} className="flex justify-between gap-3 font-semibold text-emerald-700">
                                <span className="inline-flex items-start gap-1.5">
                                  <span className="group relative inline-flex shrink-0">
                                    <button type="button" aria-label={`More information about ${row.serviceName}`} className="text-emerald-600 hover:text-brandnavy focus:outline-none"><CircleHelp className="h-3.5 w-3.5" /></button>
                                    <span role="tooltip" className="ui-tooltip pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-64 rounded-lg px-3 py-2 text-left text-xs font-normal leading-5 shadow-lg group-hover:block group-focus-within:block">{getTooltip(row)}</span>
                                  </span>
                                  <span>{row.serviceName}</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </section>
                      ) : <div />}

                      {/* Pricing summary */}
                      <div className="border-t border-slate-200 p-5">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Your pricing</p>
                        <div className="mt-3 rounded-xl bg-slate-50 p-4">
                          <div className="flex items-center justify-between gap-4 text-sm">
                            <span className="text-slate-600">
                              One-time total
                              {onboardingWaived ? <span className="mt-0.5 block text-xs font-semibold text-emerald-700">Onboarding fee waived</span> : null}
                            </span>
                            <span className="text-right font-bold" style={{ color: inkColor }}>
                              {onboardingWaived && originalOnboardingFee > 0 ? (
                                <span className="mr-1.5 font-medium text-slate-400 line-through">{fmt(originalOneTimeTotal)}</span>
                              ) : null}
                              {fmt(oneTimeTotal)}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-4 border-t border-slate-200 pt-2 text-sm">
                            <span className="text-slate-600">Ongoing bookkeeping</span>
                            <span className="font-bold" style={{ color: inkColor }}>{fmt(recurringTotal)}/mo</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={selectionSubmittingId !== null}
                          onClick={() => void selectOptionAndContinue(id)}
                          className="ui-action-primary mt-4 w-full rounded-lg border px-4 py-3 text-base font-bold transition disabled:cursor-wait disabled:opacity-60"
                        >
                          {selectionSubmittingId === id ? "Saving selection…" : `Select ${option.name}`}
                        </button>
                        {urgencyOffer.active ? (
                          <p className="mt-2 text-center text-xs font-medium text-slate-500">{urgencyOffer.ctaHint}</p>
                        ) : null}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2 — Deposit / Contract */}
          {step === 2 && !alreadySigned && (
            <div className="py-6">
              {!alreadySigned ? (
                <div className="space-y-5">
                  {urgencyOffer.active ? (
                    <ProposalUrgencyBanner offer={urgencyOffer} accentColor={actionColor} inkColor={inkColor} compact />
                  ) : null}
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">{agreementTitle}</h2>
                    <p className="mt-1 text-sm font-semibold" style={{ color: inkColor }}>
                      {engagementId
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
                      className="mt-2 max-h-[50vh] overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 focus:outline-none focus:ring-2 focus:ring-brandnavy sm:max-h-[65vh]"
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
                    {!engagementId
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
                          onPaid={(status) => {
                            if (status === "succeeded" && engagementId) {
                              void fetch(`/api/proposal/${engagementId}/confirm-payment`, { method: "POST" });
                            }
                            setPaymentStatus(status);
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
                      {engagementId && paymentClientSecret ? (
                        <>
                          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                            <div className="h-px flex-1 bg-slate-200" />
                            or pay with PayPal
                            <div className="h-px flex-1 bg-slate-200" />
                          </div>
                          <PaypalPaymentButton
                            engagementId={engagementId}
                            onPaid={(status) => { setPaymentStatus(status); setStep(3); }}
                          />
                        </>
                      ) : null}
                    </div>

                    <div className="order-1 space-y-4 md:order-2">
                      <div className="rounded-xl border border-slate-200 bg-white p-5">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Your Deposit</p>
                        {selectedOptionId ? (
                          <p className="mt-1 text-sm text-slate-600">{options[selectedOptionId].name} package</p>
                        ) : null}
                        <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                          <span className="text-sm font-semibold text-slate-700">Total due</span>
                          <span className="text-2xl font-bold text-brandnavy">
                            {selectedOnboardingFee !== null ? fmt(selectedOnboardingFee) : "—"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">Covers onboarding, document collection, and discovery. Earned upon signing and non-refundable.</p>
                      </div>
                      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                        <p className="text-xs leading-5 text-slate-500">
                          Payments are processed securely by Stripe and PayPal. Your card and bank details are never stored on our servers.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && alreadySigned && (
            <div className="py-6">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                Signed by <span className="font-semibold">{signedSignerName}</span>
                {signedAt ? ` on ${new Date(signedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : null}
              </div>
              <p className="mt-4 text-sm text-slate-600">Your agreement is complete. Continue to payment when you&apos;re ready.</p>
            </div>
          )}

          {/* Step 3 — Payment */}
          {step === 3 && !paymentStatus && requiresOnboardingPayment && (
            <div className="py-6">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                Signed by <span className="font-semibold">{signedSignerName}</span>
                {signedAt ? ` on ${new Date(signedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : null}
              </div>
              <div className="mt-4 grid gap-6 md:grid-cols-[1fr_380px] md:items-start">
                <div className="order-2 space-y-4 rounded-xl border border-slate-200 p-6 md:order-1">
                  {paymentClientSecret ? (
                    <DepositPaymentForm
                      clientSecret={paymentClientSecret}
                      onPaid={(status) => {
                        if (status === "succeeded" && engagementId) {
                          void fetch(`/api/proposal/${engagementId}/confirm-payment`, { method: "POST" });
                        }
                        setPaymentStatus(status);
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
                        {signSubmitting ? "Retrying..." : "Retry"}
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600">Preparing your payment form...</p>
                  )}
                  {engagementId && paymentClientSecret ? (
                    <>
                      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        <div className="h-px flex-1 bg-slate-200" />
                        or pay with PayPal
                        <div className="h-px flex-1 bg-slate-200" />
                      </div>
                      <PaypalPaymentButton
                        engagementId={engagementId}
                        onPaid={(status) => setPaymentStatus(status)}
                      />
                    </>
                  ) : null}
                </div>
                <div className="order-1 space-y-4 md:order-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Your Deposit</p>
                    {selectedOptionId ? <p className="mt-1 text-sm text-slate-600">{options[selectedOptionId].name} package</p> : null}
                    <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                      <span className="text-sm font-semibold text-slate-700">Total due</span>
                      <span className="text-2xl font-bold text-brandnavy">
                        {selectedOnboardingFee !== null ? fmt(selectedOnboardingFee) : "—"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Covers onboarding, document collection, and discovery. Earned upon signing and non-refundable.</p>
                  </div>
                  <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                    <p className="text-xs leading-5 text-slate-500">Payments are processed securely by Stripe and PayPal. Your card and bank details are never stored on our servers.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && !paymentStatus && (!alreadySigned || !requiresOnboardingPayment) && (
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
                    Your agreement is signed. Your bank transfer is on its way — ACH payments typically take a few business days to clear.
                    We&apos;ll email a receipt to {email || "the email you provided"} once it&apos;s confirmed, and be in touch to kick off onboarding.
                  </p>
                </>
              ) : (
                <>
                  <h1 className="mt-6 text-3xl font-bold">
                    {selectedOptionId ? `${options[selectedOptionId].name} — you&apos;re all set` : "You&apos;re all set"}
                  </h1>
                  <p className="mt-3 text-slate-600">
                    {engagementId
                      ? `Your agreement is signed and your deposit is paid. We'll be in touch shortly to kick off onboarding.`
                      : "We have your selection and will be in touch to kick off onboarding. Reach out any time if you have questions."}
                  </p>
                </>
              )}
              <p className="mt-4 text-sm font-semibold text-slate-700">{brand.name}</p>
            </div>
          )}

        </article>
      </section>

      {/* Comparison modal */}
      {comparisonOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-4 sm:p-6 lg:p-10">
          <div role="dialog" aria-modal="true" aria-labelledby="comparison-title" className="mx-auto w-full max-w-[1180px] overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-6 border-b border-slate-200 px-5 py-4 sm:px-7">
              <div>
                <h2 id="comparison-title" className="text-2xl font-bold" style={{ color: inkColor }}>Compare everything included</h2>
                <p className="mt-1 text-sm text-slate-600">Review pricing, services, and support details across all three options.</p>
              </div>
              <button type="button" onClick={() => setComparisonOpen(false)} aria-label="Close plan comparison" className="ui-action-ghost rounded-lg p-2 transition">
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="max-h-[calc(100vh-10rem)] overflow-y-auto overflow-x-hidden">
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
        </div>
      ) : null}
    </main>
  );
}

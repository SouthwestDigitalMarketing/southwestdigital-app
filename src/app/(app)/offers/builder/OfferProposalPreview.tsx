"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Check,
  ChevronRight,
  CircleHelp,
  LineChart,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useBrand } from "@/lib/brands/context";
import { getProposalTheme, BRAND_PRIMARY_SENTINEL, BRAND_ACCENT_SENTINEL } from "./proposalThemes";
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
  shortDescription: string;
  partnershipLabel: string;
  recurringRows: ServiceRow[];
  oneTimeRows: ServiceRow[];
  whatsIncluded: string[];
  whyItMatters: string[];
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

const serviceTooltips: Record<string, string> = {
  "Monthly Bookkeeping": "Includes categorizing transactions, reconciling accounts, generating your Balance Sheet and Profit & Loss statement, and executing our monthly close process. Reports and communication are delivered through your client portal.",
  "Investor Reporting & KPI Review": "Investor-focused financial reporting and KPI review to support portfolio decisions.",
  "Concierge Client Support": "24/7 priority access for bookkeeping questions and time-sensitive support needs.",
  "Priority Client Support": "Same-business-day responses for bookkeeping questions and support requests.",
  "Standard Client Support": "Responses within 1–2 business days for bookkeeping questions and support requests.",
  "Monthly Reporting Package": "A recurring financial reporting package that provides clear visibility into performance.",
  "Advanced Receipt Management": "Enhanced receipt collection, organization, and matching support.",
  "Monthly Advisory Calls": "A recurring call with your bookkeeper to review the numbers and talk through decisions. Included at no charge with Grow.",
  "CFO Pack": "Executive-level financial reporting built for owner and investor decision-making. Included at no charge with Grow.",
  "Cash Flow Analysis": "Ongoing analysis of cash inflows and outflows to support planning and investment decisions. Included at no charge with Grow.",
  "Budget Setup & Budget vs. Actuals Reporting": "We build the budget and provide recurring budget-vs-actuals reporting to track performance against it.",
  "Sales Tax Filing & Remittance": "We calculate, file, and remit the client's sales tax payments to the comptroller on their behalf.",
};

const comparisonFeatures: Array<{ label: string; description: string; includedIn: OptionId[] }> = [
  { label: "Monthly bookkeeping and reconciliations", description: "Transactions are categorized and the included accounts are reconciled each month.", includedIn: ["grow", "improve", "maintain"] },
  { label: "Monthly financial statements", description: "Core financial reports are prepared for consistent owner review.", includedIn: ["grow", "improve", "maintain"] },
  { label: "Real estate-specific reporting structure", description: "Reporting is organized to make portfolio and property performance easier to understand.", includedIn: ["grow", "improve"] },
  { label: "Expanded monthly reporting", description: "Additional reporting context supports more informed financial decisions.", includedIn: ["grow", "improve"] },
  { label: "Investor reporting and KPI review", description: "Investor-focused KPIs and reporting are reviewed for trends and opportunities.", includedIn: ["grow"] },
  { label: "Structured communication and follow-up", description: "A more proactive communication rhythm helps resolve questions and issues faster.", includedIn: ["grow", "improve"] },
  { label: "Concierge client support", description: "24/7 priority access for bookkeeping questions and time-sensitive support needs.", includedIn: ["grow"] },
  { label: "Monthly advisory calls", description: "A recurring call with your bookkeeper to review the numbers and talk through decisions.", includedIn: ["grow"] },
  { label: "CFO Pack", description: "Executive-level financial reporting built for owner and investor decision-making.", includedIn: ["grow"] },
  { label: "Cash flow analysis", description: "Ongoing analysis of cash inflows and outflows to support planning and investment decisions.", includedIn: ["grow"] },
];

const optionMeta: Array<{ id: OptionId; icon: typeof Sparkles; accentClass: string; serviceLevel: string }> = [
  { id: "grow",     icon: Sparkles,    accentClass: "text-emerald-600", serviceLevel: "Concierge" },
  { id: "improve",  icon: LineChart,   accentClass: "text-indigo-600",  serviceLevel: "Priority"  },
  { id: "maintain", icon: ShieldCheck, accentClass: "text-amber-600",   serviceLevel: "Standard"  },
];

const baseOptions: Record<OptionId, ProposalOption> = {
  grow: {
    id: "grow",
    name: "Grow",
    shortDescription: "Higher-touch reporting and guidance for scaling real estate portfolios.",
    partnershipLabel: "Strategic partnership",
    recurringRows: [
      { id: "grow-rec-1", serviceName: "Monthly Bookkeeping",           billStart: "On Acceptance", billEnd: "Until Cancelled", billEvery: "1 Month", invoiceType: "Automatic", priceType: "Fixed", quantity: 1, price: 1295 },
      { id: "grow-rec-2", serviceName: "Investor Reporting & KPI Review", billStart: "On Acceptance", billEnd: "Until Cancelled", billEvery: "1 Month", invoiceType: "Automatic", priceType: "Fixed", quantity: 1, price: 395 },
      { id: "grow-rec-3", serviceName: "Concierge Client Support",      billStart: "On Acceptance", billEnd: "Until Cancelled", billEvery: "1 Month", invoiceType: "Automatic", priceType: "Fixed", quantity: 1, price: 225, note: "24/7 priority access for bookkeeping questions and time-sensitive support needs." },
      { id: "grow-rec-4", serviceName: "Monthly Advisory Calls",        billStart: "On Acceptance", billEnd: "Until Cancelled", billEvery: "1 Month", invoiceType: "Automatic", priceType: "Fixed", quantity: 1, price: 0, note: "A recurring call with your bookkeeper to review the numbers and talk through decisions. Included at no charge with Grow." },
      { id: "grow-rec-5", serviceName: "CFO Pack",                      billStart: "On Acceptance", billEnd: "Until Cancelled", billEvery: "1 Month", invoiceType: "Automatic", priceType: "Fixed", quantity: 1, price: 0, note: "Executive-level financial reporting built for owner and investor decision-making. Included at no charge with Grow." },
      { id: "grow-rec-6", serviceName: "Cash Flow Analysis",            billStart: "On Acceptance", billEnd: "Until Cancelled", billEvery: "1 Month", invoiceType: "Automatic", priceType: "Fixed", quantity: 1, price: 0, note: "Ongoing analysis of cash inflows and outflows to support planning and investment decisions. Included at no charge with Grow." },
    ],
    oneTimeRows: [],
    whatsIncluded: [
      "Monthly bookkeeping with reconciliations and financial review structure",
      "Expanded reporting package for owners, partners, and decisions",
      "Concierge communication and our fastest response expectations",
      "Monthly advisory calls with your bookkeeper",
      "CFO Pack with executive-level financial reporting",
      "Cash flow analysis to support investment decisions",
      "A higher-touch client experience built for scaling investors",
    ],
    whyItMatters: [
      "Supports better investment decisions with clearer reporting",
      "Keeps communication fast when deals, lenders, or deadlines move quickly",
      "Creates cleaner internal processes as the business expands",
      "Reduces bookkeeping bottlenecks as complexity increases",
    ],
  },
  improve: {
    id: "improve",
    name: "Improve",
    shortDescription: "Clearer reporting and more responsive support for investors who want confidence.",
    partnershipLabel: "Enhanced partnership",
    recurringRows: [
      { id: "improve-rec-1", serviceName: "Monthly Bookkeeping",        billStart: "On Acceptance", billEnd: "Until Cancelled", billEvery: "1 Month", invoiceType: "Automatic", priceType: "Fixed", quantity: 1, price: 895 },
      { id: "improve-rec-2", serviceName: "Monthly Reporting Package",  billStart: "On Acceptance", billEnd: "Until Cancelled", billEvery: "1 Month", invoiceType: "Automatic", priceType: "Fixed", quantity: 1, price: 245 },
      { id: "improve-rec-3", serviceName: "Priority Client Support",    billStart: "On Acceptance", billEnd: "Until Cancelled", billEvery: "1 Month", invoiceType: "Automatic", priceType: "Fixed", quantity: 1, price: 0, note: "Same-business-day responses for bookkeeping questions and support requests." },
    ],
    oneTimeRows: [],
    whatsIncluded: [
      "Historical cleanup and book reconstruction where needed",
      "Real estate-specific reporting structure and cleaner monthly close",
      "Monthly financial statements with stronger reporting context",
      "More structured communication and follow-up support",
    ],
    whyItMatters: [
      "Improves visibility into performance without overcomplicating the process",
      "Helps owners feel more confident in the books each month",
      "Creates a smoother experience when questions or issues come up",
      "Supports more disciplined financial review habits",
    ],
  },
  maintain: {
    id: "maintain",
    name: "Maintain",
    shortDescription: "Core monthly bookkeeping for reliable financial clarity and consistency.",
    partnershipLabel: "Foundational partnership",
    recurringRows: [
      { id: "maintain-rec-1", serviceName: "Monthly Bookkeeping",    billStart: "On Acceptance", billEnd: "Until Cancelled", billEvery: "1 Month", invoiceType: "Automatic", priceType: "Fixed", quantity: 1, price: 649 },
      { id: "maintain-rec-2", serviceName: "Standard Client Support", billStart: "On Acceptance", billEnd: "Until Cancelled", billEvery: "1 Month", invoiceType: "Automatic", priceType: "Fixed", quantity: 1, price: 0, note: "Responses within 1–2 business days for bookkeeping questions and support requests." },
    ],
    oneTimeRows: [],
    whatsIncluded: [
      "Historical cleanup and foundational setup support",
      "Accurate monthly bookkeeping and reconciliations",
      "Monthly financial statements and reporting basics",
      "Dependable ongoing support for cleaner books",
    ],
    whyItMatters: [
      "Stay compliant with lender and tax requirements",
      "Make confident, data-driven investment decisions",
      "Save time and reduce bookkeeping stress",
      "Always know your numbers",
    ],
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
  return row.note ?? serviceTooltips[row.serviceName] ?? `Details about ${row.serviceName}.`;
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

  const built = Object.fromEntries(optionMeta.map(({ id }) => {
    const base = baseOptions[id];
    const recurringRows = base.recurringRows.map((row) => ({ ...row }));

    // Replace monthly bookkeeping price with computed value
    const nonBookkeeping = recurringRows
      .filter((r) => r.serviceName !== "Monthly Bookkeeping")
      .reduce((t, r) => t + r.price * r.quantity, 0);
    const bkRow = recurringRows.find((r) => r.serviceName === "Monthly Bookkeeping");
    if (bkRow) {
      bkRow.price = Math.max(0, packagePricing[id].monthly - nonBookkeeping);
      bkRow.platformTag = assessment.ongoingBookkeepingPlatform === "stessa" ? "Stessa" : "QBO";
    }

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
      .filter((bonus) => assessment.bonusPackageSelections[bonus.id]?.includes(id) ?? legacyBonusIncluded(bonus.id));

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
      recurringRows: [...recurringRows, ...recurringBonuses],
      oneTimeRows: [
        ...buildCleanupRows(periods, maintainMonthly, id),
        onboardingRow,
        ...oneTimeBonuses,
      ],
    }];
  })) as Record<OptionId, ProposalOption>;

  // Inherit services downward
  function inheritRecurring(higherTier: OptionId, lowerTier: OptionId) {
    const higher = built[higherTier];
    const existing = new Set(higher.recurringRows.map((r) => r.serviceName));
    const inherited = built[lowerTier].recurringRows
      .filter((r) => !r.serviceName.endsWith("Client Support"))
      .filter((r) => !existing.has(r.serviceName))
      .map((r) => ({ ...r, id: `${higherTier}-inherited-${r.id}`, price: 0, note: r.note ?? `Included from the ${built[lowerTier].name} service level.` }));
    higher.recurringRows = [...higher.recurringRows, ...inherited];
  }
  inheritRecurring("improve", "maintain");
  inheritRecurring("grow", "improve");

  return built;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TooltipIcon({ row }: { row: ServiceRow }) {
  const tip = getTooltip(row);
  return (
    <span className="group relative inline-flex shrink-0">
      <button type="button" aria-label={`More information about ${row.serviceName}`} className="text-slate-400 hover:text-brandnavy focus:text-brandnavy focus:outline-none">
        <CircleHelp className="h-3.5 w-3.5" />
      </button>
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-64 rounded-lg bg-slate-950 px-3 py-2 text-left text-xs font-normal leading-5 text-white shadow-lg group-hover:block group-focus-within:block">
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
}: {
  initialAssessment?: Partial<AssessmentState>;
  initialContactInfo?: Partial<ContactInfoState>;
  live?: boolean;
  embedded?: boolean;
  assessment?: AssessmentState;
} = {}) {
  const { brand } = useBrand();
  const { assessment: storedAssessment } = useProposalAssessmentDemoState({
    initialAssessment,
    persist: !live && !assessmentOverride,
  });
  const assessment = assessmentOverride ?? storedAssessment;
  const { contactInfo } = useProposalContactInfoDemoState({ initialContactInfo, persist: !live });
  const searchParams = useSearchParams();
  const engagementId = searchParams.get("engagementId") ?? null;

  const primary = resolvePrimaryContact(contactInfo);
  const contactName = formatPersonName(primary.firstName, primary.lastName) || contactInfo.owners[0]?.firstName || "";
  const companyName = contactInfo.companyName || contactName || "Your business";

  const theme = getProposalTheme(assessment.proposalTheme || "brand");
  const brandPrimary = brand.theme?.proposalPrimaryColor ?? brand.theme?.primaryColor ?? "#17324d";
  const brandAccent = brand.theme?.proposalAccentColor ?? brand.theme?.accentColor ?? "#d79b3b";
  const brandAccentDark = brand.theme?.accentDarkColor ?? brandAccent;
  const brandDark = brand.theme?.darkColor ?? brandPrimary;
  const primaryColor =
    theme.primary === null ? brandPrimary :
    theme.primary === BRAND_ACCENT_SENTINEL ? brandAccent :
    theme.primary === BRAND_PRIMARY_SENTINEL ? brandPrimary :
    theme.primary;
  const accentColor =
    theme.accent === null ? brandAccent :
    theme.accent === BRAND_ACCENT_SENTINEL ? brandAccent :
    theme.accent === BRAND_PRIMARY_SENTINEL ? brandPrimary :
    theme.accent;
  const actionColor = theme.id === "brand-light" ? brandAccentDark : accentColor;

  const options = buildOptions(assessment);
  const [selectedOptionId, setSelectedOptionId] = useState<OptionId | null>(null);
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
  const [signerName, setSignerName] = useState(contactName);
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
  const [agreementLoading, setAgreementLoading] = useState(false);
  const agreementScrollRef = useRef<HTMLDivElement>(null);
  const streamIframeRef = useRef<HTMLIFrameElement>(null);
  const streamPlayerRef = useRef<CloudflareStreamPlayer | null>(null);
  const playRequestedRef = useRef(false);
  const introVideoUrl = assessment.featuredVideoUrl || brand.theme?.proposalFeaturedVideoUrl || "";
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
    if (step !== 2 || !engagementId) return;
    setAgreementLoading(true);
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

  async function submitSignatureAndContinue() {
    if (!engagementId) { setStep(3); return; }
    if (!alreadySigned && !canSignAgreement) return;
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
        setStep(3);
        return;
      }
      const paymentResponse = await fetch(`/api/proposal/${engagementId}/payment-intent`, { method: "POST" });
      const paymentResult = await paymentResponse.json().catch(() => null) as { clientSecret?: string; error?: string } | null;
      if (!paymentResponse.ok || !paymentResult?.clientSecret) {
        throw new Error(paymentResult?.error ?? "Unable to start payment");
      }
      setPaymentClientSecret(paymentResult.clientSecret);
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

  const clientSteps = ["Cover", "Services", "Deposit", "Confirmation"] as const;
  const selectedOnboardingFee = selectedOptionId
    ? (options[selectedOptionId].oneTimeRows.find((r) => isOnboarding(r))?.price ?? null)
    : null;

  return (
    <main
      className={`relative isolate overflow-hidden px-4 py-6 text-brandnavy [&_button:not(:disabled)]:cursor-pointer [&_button:disabled]:cursor-not-allowed sm:px-6 lg:px-10 ${
        embedded ? "min-h-[40rem]" : "min-h-screen"
      }`}
      style={{
        background: theme.pageBg,
        "--brand-primary": primaryColor,
        "--brand-accent": accentColor,
        "--brand-ink": primaryColor,
        "--brand-dark": brandDark,
        "--color-accent-500": accentColor,
        "--color-accent-100": `color-mix(in srgb, ${accentColor} 15%, white)`,
      } as React.CSSProperties}
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

        {/* Nav bar */}
        <nav aria-label="Proposal navigation" className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
            {step === 0 ? <span className="w-[74px]" /> : (
              <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold" style={{ color: brandDark }}>Back</button>
            )}
            <ol className="flex items-start justify-center">
              {clientSteps.map((label, index) => (
                <li key={label} className="flex items-start">
                  {index > 0 && <span className="mt-4 h-0.5 w-5 sm:w-10" style={{ backgroundColor: index <= step ? brandDark : "#cbd5e1" }} />}
                  <div className="w-16 text-center sm:w-20">
                    <span
                      className={`mx-auto grid h-8 w-8 place-items-center rounded-full border text-sm font-bold ${index <= step ? "text-white" : "border-slate-300 bg-white text-slate-500"}`}
                      style={index <= step ? { backgroundColor: brandDark, borderColor: brandDark } : undefined}
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
                className="inline-flex items-center gap-2 rounded-lg border-2 px-5 py-2 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:brightness-95 hover:shadow-[0_6px_16px_rgba(15,23,42,0.22)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                style={{ backgroundColor: actionColor, borderColor: actionColor }}
              >
                Next <ChevronRight strokeWidth={3} className="h-4 w-4" />
              </button>
            ) : step === 2 && !(paymentClientSecret || alreadySigned) ? (
              <button
                type="button"
                disabled={engagementId ? (!alreadySigned && (!canSignAgreement || signSubmitting)) : false}
                onClick={() => void submitSignatureAndContinue()}
                className="inline-flex items-center gap-2 rounded-lg border-2 border-accent-500 bg-brandnavy px-5 py-2 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-slate-950 hover:shadow-[0_6px_16px_rgba(15,23,42,0.22)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                {!engagementId
                  ? <>Continue <ChevronRight strokeWidth={3} className="h-4 w-4" /></>
                  : signSubmitting
                    ? "Submitting…"
                    : alreadySigned
                      ? <>Continue to Payment <ChevronRight strokeWidth={3} className="h-4 w-4" /></>
                      : <>I Agree — Sign &amp; Continue <ChevronRight strokeWidth={3} className="h-4 w-4" /></>}
              </button>
            ) : <span className="w-20" />}
          </div>
        </nav>

        <article className="space-y-8 bg-transparent">

          {/* Header (cover + deposit only) */}
          {(step === 0 || step === 2) ? (
            <header className="flex flex-wrap items-center justify-between gap-4">
              <div>
                {brand.theme?.logoUrl ? (
                  <img src={brand.theme.logoUrl} alt={brand.name} className="max-h-10 max-w-44 object-contain" />
                ) : (
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{brand.name}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Prepared for</p>
                <p className="mt-1 font-semibold" style={{ color: brandDark }}>{companyName}</p>
              </div>
            </header>
          ) : null}

          {/* Step 0 — Intro */}
          {step === 0 && (() => {
            const imageUrl = assessment.featuredImageUrl || brand.theme?.proposalFeaturedImageUrl || "";
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
            return (
              <div className="pb-12 sm:pb-16">
                <div className={`grid items-center gap-8 ${hasMedia ? "md:grid-cols-2" : ""}`}>
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: brandDark }}>
                      {customHeadline ?? (
                        <>
                          Expert <span className="text-accent-500">Real Estate</span> Bookkeeping +{" "}
                          Great <span className="text-accent-500">Communication</span>
                        </>
                      )}
                    </h1>
                    <p className={`mt-6 text-lg leading-8 text-slate-600 ${hasMedia ? "" : "max-w-2xl"}`}>
                      {introBodyCopy}
                      {includesRegisteredAgentMessage ? <span className="mt-3 flex items-center gap-2 pt-2 text-base font-semibold text-slate-600"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: brandDark }}><Check className="h-3 w-3" /></span>{registeredAgentMessage}</span> : null}
                    </p>
                    <div className="mt-8 space-y-3">
                      {embedUrl ? (
                        <button
                          type="button"
                          onClick={toggleIntroVideo}
                          aria-pressed={isIntroVideoPlaying}
                          aria-label={isIntroVideoPlaying ? "Pause client testimonial" : "Play client testimonial"}
                          className={`inline-flex w-full items-center justify-center gap-2 rounded-lg border px-6 py-3 text-lg font-bold transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(15,23,42,0.22)] ${hasStartedIntroVideo ? "border-slate-300 bg-white text-slate-500" : "text-white hover:brightness-95"}`}
                          style={hasStartedIntroVideo ? undefined : { backgroundColor: actionColor, borderColor: actionColor }}
                        >
                          Client Testimonial {isIntroVideoPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className={`inline-flex w-full items-center justify-center gap-2 rounded-lg border px-6 py-3 text-lg font-bold transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(15,23,42,0.22)] ${hasStartedIntroVideo ? "text-white hover:brightness-95" : "border-slate-300 bg-white text-slate-500"}`}
                        style={hasStartedIntroVideo ? { backgroundColor: actionColor, borderColor: actionColor } : undefined}
                      >
                        Shop pricing
                      </button>
                      {introVideoError ? <p role="alert" className="mt-2 text-sm text-red-700">{introVideoError}</p> : null}
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
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt=""
                      className="max-h-[320px] w-full rounded-xl border object-cover shadow-sm"
                      style={{ borderColor: "#cbd5e1" }}
                    />
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
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: brandDark }}>Select your services</h1>
              </div>

              {/* Annual toggle */}
              <div className="mb-8 flex flex-wrap items-center justify-center gap-4 text-base font-bold sm:text-lg">
                <span className={hasTwelveMonthAgreement ? "text-slate-400" : undefined} style={hasTwelveMonthAgreement ? undefined : { color: brandDark }}>Month-to-month</span>
                <button type="button" role="switch" aria-checked={hasTwelveMonthAgreement} onClick={() => setHasTwelveMonthAgreement((v) => !v)} className={`relative h-9 w-16 rounded-full transition ${hasTwelveMonthAgreement ? "" : "bg-slate-300"}`} style={hasTwelveMonthAgreement ? { backgroundColor: brandDark } : undefined}>
                  <span className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow-sm transition ${hasTwelveMonthAgreement ? "left-8" : "left-1"}`} />
                  <span className="sr-only">
                    {annualSavingsPercent > 0
                      ? `Save ${annualSavingsPercent}% with a 12-month agreement`
                      : "Choose a 12-month agreement"}
                  </span>
                </button>
                <button type="button" aria-pressed={hasTwelveMonthAgreement} onClick={() => setHasTwelveMonthAgreement(true)} className={`inline-flex items-center gap-1.5 rounded-lg border bg-accent-100 px-3 py-1.5 transition hover:brightness-95 ${hasTwelveMonthAgreement ? "" : "border-transparent"}`} style={{ color: brandDark, borderColor: hasTwelveMonthAgreement ? brandDark : undefined }}>
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
                    sectionTotal(option.recurringRows) * recurringDiscountMultiplier +
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
                  const isNew = (name: string) => lowerTierId !== null && !lowerTierRecurring.has(name);
                  const lowerTierZero = new Set(lowerTierId ? options[lowerTierId].oneTimeRows.filter((r) => r.price === 0).map((r) => r.serviceName) : []);
                  const displayedBonuses = lowerTierId ? zeroPriceRows.filter((r) => !lowerTierZero.has(r.serviceName)) : zeroPriceRows;

                  const bkRow      = option.recurringRows.find((r) => r.serviceName === "Monthly Bookkeeping");
                  const supportRow = option.recurringRows.find((r) => r.serviceName.endsWith("Client Support"));
                  const otherRecurring = option.recurringRows.filter((r) => r.serviceName !== "Monthly Bookkeeping" && !r.serviceName.endsWith("Client Support"));
                  const orderedRecurring = lowerTierId ? otherRecurring.filter((r) => isNew(r.serviceName)) : otherRecurring;

                  return (
                    <section key={id} className="grid grid-rows-subgrid row-span-7 overflow-hidden rounded-xl border bg-white shadow-sm transition-colors" style={{ borderColor: selected ? brandDark : "#e2e8f0" }}>
                      {/* Card header */}
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h2 className="text-2xl font-bold" style={{ color: brandDark }}>{option.name}</h2>
                            <button type="button" onClick={() => setComparisonOpen(true)} className="mt-1 hidden text-xs font-semibold underline underline-offset-2" style={{ color: brandDark }}>
                              See everything included
                            </button>
                          </div>
                          <div className="space-y-1 text-right text-sm">
                            <p>
                              {onboardingWaived && originalOnboardingFee > 0 ? (
                                <span className="mr-1.5 text-slate-400 line-through">{fmt(originalOneTimeTotal)}</span>
                              ) : null}
                              <span className="font-bold" style={{ color: brandDark }}>{fmt(oneTimeTotal)}</span> <span className="text-slate-500">One-Time</span>
                            </p>
                            {onboardingWaived ? (
                              <p className="text-xs font-semibold text-emerald-700">Onboarding fee waived</p>
                            ) : null}
                            <p><span className={`font-bold ${hasTwelveMonthAgreement ? "rounded bg-accent-100 px-1.5 py-0.5" : ""}`} style={{ color: brandDark }}>{fmt(recurringTotal)}</span> <span className="text-slate-500">/mo</span></p>
                          </div>
                        </div>
                        <p className="mt-4 text-center text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{serviceLevel} service level</p>
                        <button type="button" onClick={() => {
                                          setSelectedOptionId(id);
                                          setStep(2);
                                          if (engagementId) {
                                            const onbFee = option.oneTimeRows.find((r) => isOnboarding(r))?.price ?? 0;
                                            void fetch(`/api/proposal/${engagementId}/select`, {
                                              method: "POST",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({
                                                tier: id,
                                                tierLabel: option.name,
                                                onboardingFee: onbFee,
                                                recurringMonthlyTotal: option.recurringRows.reduce((s, r) => s + r.price, 0),
                                              }),
                                            });
                                          }
                                        }} aria-pressed={selected} className="mt-4 w-full rounded-lg border px-4 py-3 text-base font-bold text-white transition hover:opacity-90" style={{ backgroundColor: actionColor, borderColor: actionColor }}>
                          Select {option.name}
                        </button>
                      </div>

                      {/* One-time services */}
                      <section className="border-t border-slate-200">
                        <p className="px-5 py-3 text-xs font-bold uppercase tracking-[0.12em]" style={{ backgroundColor: `color-mix(in srgb, ${brandDark} 10%, white)`, color: brandDark }}>One-time services</p>
                        <div className="px-5 py-4">
                          {requiredOnboard.length ? <div className="mt-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Required to get started</p><ul className="mt-2 space-y-2 text-sm text-slate-600">{requiredOnboard.map((row) => <ServiceLine key={row.id} row={row} originalPrice={onboardingWaived && isOnboarding(row) ? originalOnboardingFee : undefined} waivedLabel={onboardingWaived && isOnboarding(row) ? "Waived" : undefined} />)}</ul></div> : null}
                          {optionalCleanup.length ? <div className="mt-5 border-t border-slate-200 pt-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Optional catch-up</p><ul className="mt-4 space-y-7 text-sm text-slate-600">{optionalCleanup.map((row) => <ServiceLine key={row.id} row={row} selected={cleanupIsSelected(id, row.cleanupPeriodKey!)} onToggle={(checked) => setCleanupSelections((prev) => ({ ...prev, [cleanupKey(id, row.cleanupPeriodKey!)]: checked }))} showPriceWhenUnselected />)}</ul></div> : null}
                          {additionalSetup.length ? <div className="mt-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Additional setup</p><ul className="mt-2 space-y-2 text-sm text-slate-600">{additionalSetup.map((row) => <ServiceLine key={row.id} row={row} />)}</ul></div> : null}
                        </div>
                      </section>

                      {/* Recurring services */}
                      <section>
                        <p className="px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-white" style={{ backgroundColor: brandDark }}>Recurring services</p>
                        {bkRow && !lowerTierId ? <div className="px-5 pt-4"><p className="text-sm font-semibold text-slate-500">Monthly Bookkeeping</p><p className="mt-1 text-sm leading-6 text-slate-600">{getTooltip(bkRow)}</p></div> : null}
                        {lowerTierName ? <p className="px-5 pt-4 text-sm font-semibold text-slate-500">Everything in {lowerTierName}, plus:</p> : null}
                        <ul className="space-y-2 pl-8 pr-5 pt-4 pb-2 text-sm text-slate-600">
                          {orderedRecurring.map((row) => (
                            <li key={row.id} className={`flex justify-between gap-3 ${isNew(row.serviceName) ? "font-semibold text-emerald-700" : ""}`}>
                              <span className="inline-flex items-start gap-1.5">
                                <span className="group relative inline-flex shrink-0">
                                  <button type="button" aria-label={`More information about ${row.serviceName}`} className={`${isNew(row.serviceName) ? "text-emerald-600" : "text-slate-400"} hover:text-brandnavy focus:text-brandnavy focus:outline-none`}><CircleHelp className="h-3.5 w-3.5" /></button>
                                  <span role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-64 rounded-lg bg-slate-950 px-3 py-2 text-left text-xs font-normal leading-5 text-white shadow-lg group-hover:block group-focus-within:block">{getTooltip(row)}</span>
                                </span>
                                <span>{row.serviceName}</span>
                                {row.platformTag ? <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isNew(row.serviceName) ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-brandnavy"}`}>{row.platformTag}</span> : null}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </section>

                      {/* Support row */}
                      {supportRow ? <div className="border-t border-slate-200 px-5 py-4"><p className="text-sm font-semibold text-slate-500">{supportRow.serviceName}</p><p className="mt-1 text-sm leading-6 text-slate-600">{getTooltip(supportRow)}</p></div> : <div />}

                      {additionalOptionRows.length > 0 ? (
                        <section>
                          <p className="bg-accent-100 px-5 py-3 text-xs font-bold uppercase tracking-[0.12em]" style={{ color: brandDark }}>Additional options</p>
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
                          {lowerTierName ? <p className="px-5 pt-4 text-sm font-semibold text-slate-500">Everything in {lowerTierName}, plus:</p> : null}
                          <ul className="space-y-2 pl-8 pr-5 pt-4 pb-2 text-sm text-slate-600">
                            {displayedBonuses.map((row) => (
                              <li key={row.id} className="flex justify-between gap-3 font-semibold text-emerald-700">
                                <span className="inline-flex items-start gap-1.5">
                                  <span className="group relative inline-flex shrink-0">
                                    <button type="button" aria-label={`More information about ${row.serviceName}`} className="text-emerald-600 hover:text-brandnavy focus:outline-none"><CircleHelp className="h-3.5 w-3.5" /></button>
                                    <span role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-64 rounded-lg bg-slate-950 px-3 py-2 text-left text-xs font-normal leading-5 text-white shadow-lg group-hover:block group-focus-within:block">{getTooltip(row)}</span>
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
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Your pricing</p>
                        <div className="mt-3 rounded-xl bg-slate-50 p-4">
                          <div className="flex items-center justify-between gap-4 text-sm">
                            <span className="text-slate-600">
                              One-time total
                              {onboardingWaived ? <span className="mt-0.5 block text-xs font-semibold text-emerald-700">Onboarding fee waived</span> : null}
                            </span>
                            <span className="text-right font-bold" style={{ color: brandDark }}>
                              {onboardingWaived && originalOnboardingFee > 0 ? (
                                <span className="mr-1.5 font-medium text-slate-400 line-through">{fmt(originalOneTimeTotal)}</span>
                              ) : null}
                              {fmt(oneTimeTotal)}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-4 border-t border-slate-200 pt-2 text-sm">
                            <span className="text-slate-600">Ongoing bookkeeping</span>
                            <span className="font-bold" style={{ color: brandDark }}>{fmt(recurringTotal)}/mo</span>
                          </div>
                        </div>
                        <button type="button" onClick={() => {
                                          setSelectedOptionId(id);
                                          setStep(2);
                                          if (engagementId) {
                                            const onbFee = option.oneTimeRows.find((r) => isOnboarding(r))?.price ?? 0;
                                            void fetch(`/api/proposal/${engagementId}/select`, {
                                              method: "POST",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({
                                                tier: id,
                                                tierLabel: option.name,
                                                onboardingFee: onbFee,
                                                recurringMonthlyTotal: option.recurringRows.reduce((s, r) => s + r.price, 0),
                                              }),
                                            });
                                          }
                                        }} className="mt-4 w-full rounded-lg border px-4 py-3 text-base font-bold text-white transition hover:opacity-90" style={{ backgroundColor: actionColor, borderColor: actionColor }}>
                          Select {option.name}
                        </button>
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2 — Deposit / Contract */}
          {step === 2 && (
            <div className="py-6">
              {!alreadySigned ? (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Bookkeeping Services Agreement</h2>
                    <p className="mt-1 text-sm font-semibold text-brandnavy">
                      {engagementId
                        ? "You must read the entire agreement below before you can sign."
                        : "Review your agreement. In a live proposal, you would sign here before paying."}
                    </p>
                    <div
                      ref={agreementScrollRef}
                      onScroll={(event) => checkAgreementScrolled(event.currentTarget)}
                      tabIndex={0}
                      role="region"
                      aria-label="Bookkeeping Services Agreement text, scroll to review"
                      className="mt-2 max-h-[50vh] overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 focus:outline-none focus:ring-2 focus:ring-brandnavy sm:max-h-[65vh]"
                    >
                      {agreementLoading ? (
                        <p className="text-sm text-slate-500">Loading your agreement…</p>
                      ) : agreementText ? (
                        <AgreementTextView text={agreementText} />
                      ) : (
                        <p className="text-sm text-slate-500">
                          {engagementId
                            ? "Unable to load agreement text. Please refresh and try again."
                            : "Agreement text will appear here when this proposal is sent to a client."}
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
                    <label className="mb-1 block text-sm font-semibold text-slate-700" htmlFor="signerName">Full Name</label>
                    <input
                      id="signerName"
                      type="text"
                      required
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
                          onPaid={(status) => { setPaymentStatus(status); setStep(3); }}
                        />
                      ) : signError ? (
                        <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                          <p className="text-xs text-red-700">We couldn&apos;t start the payment form: {signError} Please try again.</p>
                          <button
                            type="button"
                            disabled={signSubmitting}
                            onClick={() => void submitSignatureAndContinue()}
                            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
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

          {/* Step 3 — Confirmation */}
          {step === 3 && (
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
                <h2 id="comparison-title" className="text-2xl font-bold" style={{ color: brandDark }}>Compare everything included</h2>
                <p className="mt-1 text-sm text-slate-600">Review pricing, services, and support details across all three options.</p>
              </div>
              <button type="button" onClick={() => setComparisonOpen(false)} aria-label="Close plan comparison" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-brandnavy">
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
                  <tr style={{ backgroundColor: `color-mix(in srgb, ${brandDark} 10%, white)` }}><th colSpan={4} className="px-5 py-2.5 text-left text-xs font-bold uppercase tracking-wide" style={{ color: brandDark }}>One-time services</th></tr>
                  {oneTimeServiceNames.map((name, i) => {
                    const ref = optionMeta.map(({ id }) => options[id].oneTimeRows.find((r) => r.serviceName === name)).find(Boolean);
                    return (
                      <tr key={name} className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                        <th scope="row" className="px-5 py-3 text-left align-top font-semibold" style={{ color: brandDark }}>
                          {name}
                          {ref ? <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">{getTooltip(ref)}</span> : null}
                        </th>
                        {optionMeta.map(({ id }) => {
                          const row = options[id].oneTimeRows.find((r) => r.serviceName === name);
                          return <td key={id} className="px-4 py-3 text-center align-middle">{row ? <Check aria-label="Included" className="mx-auto h-5 w-5" style={{ color: brandDark }} /> : <span className="text-slate-300">—</span>}</td>;
                        })}
                      </tr>
                    );
                  })}
                  <tr style={{ backgroundColor: brandDark }}><th colSpan={4} className="px-5 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-white">Recurring services</th></tr>
                  {recurringServiceNames.map((name, i) => {
                    const ref = optionMeta.map(({ id }) => options[id].recurringRows.find((r) => r.serviceName === name)).find(Boolean);
                    return (
                      <tr key={name} className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                        <th scope="row" className="px-5 py-3 text-left align-top font-semibold" style={{ color: brandDark }}>
                          {name}
                          {ref ? <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">{getTooltip(ref)}</span> : null}
                        </th>
                        {optionMeta.map(({ id }) => {
                          const row = options[id].recurringRows.find((r) => r.serviceName === name);
                          return <td key={id} className="px-4 py-3 text-center align-middle">{row ? <Check aria-label="Included" className="mx-auto h-5 w-5" style={{ color: brandDark }} /> : <span className="text-slate-300">—</span>}</td>;
                        })}
                      </tr>
                    );
                  })}
                  <tr style={{ backgroundColor: `color-mix(in srgb, ${brandDark} 8%, white)` }}><th colSpan={4} className="px-5 py-2.5 text-left text-xs font-bold uppercase tracking-wide" style={{ color: brandDark }}>Bookkeeping and support details</th></tr>
                  {comparisonFeatures.map((feature, i) => (
                    <tr key={feature.label} className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                      <th scope="row" className="px-5 py-3 text-left align-top font-semibold text-brandnavy">
                        {feature.label}
                        <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">{feature.description}</span>
                      </th>
                      {optionMeta.map(({ id }) => (
                        <td key={id} className="px-4 py-3 text-center align-middle">
                          {feature.includedIn.includes(id) ? <Check aria-label="Included" className="mx-auto h-5 w-5" style={{ color: brandDark }} /> : <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

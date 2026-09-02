"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import IncludedServicesBuilder from "./IncludedServicesBuilder";
import ProposalAppCollapsibleSection from "./ProposalAppCollapsibleSection";
import type { ProposalAppCollapsibleForceSignal } from "./ProposalAppCollapsibleSection";
import type { IncludedCatalogService } from "./IncludedServicesBuilder";
import type { ProposalOptionCatalogItem } from "@/lib/quotes/catalog";
import ProposalAppDemoHeader from "./ProposalAppDemoHeader";
import ProposalAppExpandAllControl from "./ProposalAppExpandAllControl";
import PricingSnapshotSidebar from "./PricingSnapshotSidebar";
import { ASSESSMENT_STORAGE_KEY } from "./ProposalBuilderStorage";
import {
  formatPersonName,
  resolvePrimaryContact,
  useProposalContactInfoDemoState,
  type ContactInfoState,
  type OwnerContact,
} from "./ProposalContactInfoState";
import {
  CircleHelp,
  Plus,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trash2,
} from "lucide-react";
import {
  DEFAULT_HERO_CONTINUE_BUTTON,
  DEFAULT_HERO_MEDIA_BUTTON,
  normalizeHeroButton,
  type HeroButtonConfig,
} from "./heroButtons";
import {
  DEFAULT_URGENCY_OFFER,
  normalizeUrgencyOffer,
  type UrgencyOfferConfig,
} from "./urgencyOffer";
import { useBrand } from "@/lib/brands/context";
import { DEFAULT_PROPOSAL_THEME_ID, DEFAULT_PROPOSAL_MODE } from "./proposalThemes";

export type PackageId = "maintain" | "improve" | "grow";
export type ProposalBonusId =
  | "stessa-migration"
  | "tax-preparer-coordination"
  | "property-reporting-setup"
  | "document-organization"
  | "quarterly-review"
  | "doublehq-client-portal"
  | "real-estate-chart-of-accounts"
  | "new-quickbooks-file"
  | "per-property-class-tracking";
type BookSetType = "" | "real-estate-only" | "mixed-books" | "other-business" | "unknown";
type RealEstateOperation =
  | "buy-hold"
  | "long-term-rentals"
  | "short-term-rentals"
  | "flips"
  | "land"
  | "development"
  | "unknown";
type TransactionBand = "" | "0-99" | "100-499" | "500-999" | "1000+" | "unknown";
export type HistoricalCleanupPeriod = {
  id: string;
  year: number;
  startMonth: number;
  endMonth: number;
  platform?: BookkeepingPlatform;
  purchasedOrSoldPropertiesCount?: number | "";
};
export type BookkeepingPlatform = "qbo" | "stessa";
type PaymentPlatform =
  | "paypal"
  | "cash-app"
  | "venmo"
  | "stripe"
  | "airbnb-payouts"
  | "other"
  | "unknown";
type DemoComplexityLevel = "standard" | "complex" | "advanced";
type EntityType =
  | ""
  | "llc"
  | "s-corp"
  | "c-corp"
  | "partnership"
  | "sole-proprietor"
  | "trust"
  | "other"
  | "unknown";
type TaxElection =
  | ""
  | "disregarded"
  | "partnership"
  | "s-corp"
  | "c-corp"
  | "trust-estate"
  | "unknown";
type PayrollProvider =
  | ""
  | "gusto"
  | "quickbooks-payroll"
  | "adp"
  | "paychex"
  | "rippling"
  | "justworks"
  | "other"
  | "unknown";
type PayCadence = "" | "weekly" | "every-other-week" | "twice-a-month" | "monthly" | "unknown";
type PayrollResponsibleParty =
  | ""
  | "owner"
  | "admin-assistant"
  | "internal-bookkeeper"
  | "payroll-provider-managed"
  | "outsourced-accountant"
  | "other"
  | "unknown";
type PayrollQboIntegrationStatus =
  | ""
  | "fully-integrated"
  | "partially-integrated"
  | "not-integrated"
  | "unsure";
type PayrollPaymentMethod =
  | "direct-deposit"
  | "paper-check"
  | "cash"
  | "venmo"
  | "zelle"
  | "cash-app"
  | "other"
  | "unknown";
type ContractorType =
  | "cleaner"
  | "landscaping"
  | "handyman"
  | "hvac"
  | "plumber"
  | "electrician"
  | "pest-control"
  | "pool-service"
  | "snow-removal"
  | "property-manager"
  | "locksmith"
  | "painter"
  | "other"
  | "unknown";
type ContractorPayCadence =
  | ""
  | "regular-schedule"
  | "per-job-milestone"
  | "mixed"
  | "unsure";
type ContactSourceType = "" | "primary-contact" | "business-owner" | "custom";
type CustomerInvoicingMethod =
  | "appfolio"
  | "buildium"
  | "rentec-direct"
  | "tenantcloud"
  | "quickbooks-invoicing"
  | "paypal"
  | "venmo"
  | "zelle"
  | "cash-app"
  | "check-mail"
  | "other"
  | "unknown";
type BankOption =
  | "chase"
  | "bank-of-america"
  | "wells-fargo"
  | "us-bank"
  | "pnc"
  | "truist"
  | "regions"
  | "fifth-third"
  | "mercury"
  | "novo"
  | "relay"
  | "bluevine"
  | "grasshopper"
  | "local-community-bank"
  | "other"
  | "unknown";
type CountValue = number | "";
export type ProposalAdditionalOption = {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  showInProposal: boolean;
  archived: boolean;
  realEstateSpecific?: boolean;
  applicable?: boolean;
  applicabilityReason?: string;
};
export type ProposalBonusCadence = "monthly" | "one-time";
export type ProposalBonus = {
  id: string;
  name: string;
  description: string;
  archived: boolean;
  realEstateSpecific?: boolean;
  billingCadence?: ProposalBonusCadence;
  defaultPackageIds?: PackageId[];
  applicable?: boolean;
  applicabilityReason?: string;
};
export type QboAccessStatus =
  | "not_requested"
  | "requested_not_received"
  | "invite_received_review_not_completed"
  | "review_completed"
  | "unknown";

export type AssessmentState = {
  clientName: string;
  contactEmail: string;
  contactPhone: string;
  contactRole: string;
  companyName: string;
  bookSetType: BookSetType;
  realEstateOperations: RealEstateOperation[];
  transactionBand: TransactionBand;
  entityType: EntityType;
  taxElection: TaxElection;
  booksOverTwoMonthsBehind: boolean | null;
  runsPayroll: boolean | null;
  payrollProvider: PayrollProvider;
  payCadence: PayCadence;
  payrollResponsibleParty: PayrollResponsibleParty;
  payrollQboIntegrationStatus: PayrollQboIntegrationStatus;
  payrollPaymentMethods: PayrollPaymentMethod[];
  payrollContactSource: ContactSourceType;
  payrollContactOwnerId: string;
  payrollContactFirstName: string;
  payrollContactLastName: string;
  payrollContactEmail: string;
  payrollContactPhone: string;
  numberOfProperties: CountValue;
  numberOfEntities: CountValue;
  employeesCount: CountValue;
  contractorsCount: CountValue;
  recurringContractorTypes: ContractorType[];
  contractorPayCadence: ContractorPayCadence;
  hasAdminAssistant: boolean | null;
  adminAssistantContactSource: ContactSourceType;
  adminAssistantContactOwnerId: string;
  adminAssistantFirstName: string;
  adminAssistantLastName: string;
  adminAssistantEmail: string;
  adminAssistantPhone: string;
  bankAccountsCount: CountValue;
  creditCardsCount: CountValue;
  unconnectedBankAccountsCount: CountValue;
  unconnectedCreditCardsCount: CountValue;
  paymentPlatforms: PaymentPlatform[];
  zeroBalancePlatformCount: CountValue;
  loansCount: CountValue;
  vehicleNotesCount: CountValue;
  linesOfCreditCount: CountValue;
  unconnectedLinesOfCreditCount: CountValue;
  banksUsed: BankOption[];
  banksAllowDelegateAccess: boolean | null;
  customerInvoicingMethods: CustomerInvoicingMethod[];
  acceptsTipsForContractors: boolean | null;
  hasTipsLiabilityAccount: boolean | null;
  cleanupStartMonth: string;
  cleanupEndMonth: string;
  historicalCleanupPeriods: HistoricalCleanupPeriod[];
  waiveOnboardingFee: boolean;
  onboardingFeeOverride: number | null;
  annualSavingsPercent: number;
  includeConditionalStessaMigration: boolean;
  includeTaxPreparerCoordinationCall: boolean;
  includePropertyLevelReportingSetup: boolean;
  includeDocumentOrganizationSetup: boolean;
  includeQuarterlyFinancialReview: boolean;
  includeDoubleHqClientPortal: boolean;
  includeRealEstateChartOfAccounts: boolean;
  includeNewQuickBooksFileSetup: boolean;
  bonusPackageSelections: Record<string, PackageId[]>;
  offerAdvancedReceiptManagement: boolean;
  advancedReceiptManagementPriceOverride: number | null;
  offerProjectTracking: boolean;
  projectTrackingPriceOverride: number | null;
  offerBudgetReporting: boolean;
  budgetReportingPriceOverride: number | null;
  offerSalesTaxFiling: boolean;
  salesTaxFilingPriceOverride: number | null;
  includeRegisteredAgentService: boolean;
  additionalOptions: ProposalAdditionalOption[];
  bonuses: ProposalBonus[];
  optionsCatalogOrder: string[];
  featuredImageUrl: string;
  featuredVideoUrl: string;
  featuredMediaId: string;
  introHeadline: string;
  introBody: string;
  heroMediaButton: HeroButtonConfig;
  heroContinueButton: HeroButtonConfig;
  urgencyOffer: UrgencyOfferConfig;
  proposalTheme: string;
  proposalMode: "light" | "dark";
  agreementTemplateId?: string;
  agreementTemplateName?: string;
  agreementTemplateContent?: string;
  ongoingBookkeepingPlatform: BookkeepingPlatform;
  platformMigrationEnabled: boolean;
  platformMigrationEffectiveMonth: string;
  cleanupPurchasedOrSoldPropertiesCount: CountValue;
  discretionaryMultiplier: number;
  discretionaryMultiplierNote: string;
  currentBookkeepingStatus: string;
  assessmentNotes: string;
  qboAccessStatus: QboAccessStatus;
};

type ThresholdAmount = Array<{ min: number; amount: number }>;

type DemoPricingConfig = {
  recurringPerProperty: number;
  recurringPerEntity: number;
  recurringComplexity: Record<DemoComplexityLevel, number>;
  transactionBandMonthly: Record<Exclude<TransactionBand, "">, number>;
  staffingPerPerson: number;
  reconciliationThresholds: ThresholdAmount;
  platformThresholds: ThresholdAmount;
  passThroughThresholds: ThresholdAmount;
  mixedBooksMonthly: number;
  nonReBusinessMonthly: number;
  complexOperationsMonthly: number;
  multiOperationMonthly: number;
  backlogPerProperty: number;
  backlogPerEntity: number;
  catchUpComplexityMultiplier: Record<DemoComplexityLevel, number>;
};

type PackageDefinition = {
  id: PackageId;
  name: string;
  monthlyPrice: number;
  description: string;
  includedServices: string[];
  accentClass: string;
  icon: typeof ShieldCheck;
  clientFit: string;
  pricing: DemoPricingConfig;
};

type RecommendationSummary = {
  servicePath: string;
  packageId: PackageId;
  confidence: string;
  rationale: string[];
  watchouts: string[];
};

type PackagePricingSummary = {
  packageId: PackageId;
  complexityLevel: DemoComplexityLevel;
  monthly: number;
  catchUpBase: number;
  assessmentOneTimeAdjustments: number;
  totalOneTimeBeforeManual: number;
  totalOneTime: number;
};

type MonthlyRateBreakdownItem = {
  label: string;
  amount: number;
};

type ProposalAssessmentStep = "scale" | "pricing" | "included" | "calculator";

const CLEANUP_PURCHASED_OR_SOLD_PROPERTY_COST = 200;
const CURRENT_DATE = new Date();
const CURRENT_YEAR = CURRENT_DATE.getFullYear();
const LAST_COMPLETED_MONTH = Math.max(1, CURRENT_DATE.getMonth());
const MONTH_OPTIONS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const INITIAL_ASSESSMENT: AssessmentState = {
  clientName: "",
  contactEmail: "",
  contactPhone: "",
  contactRole: "",
  companyName: "",
  bookSetType: "",
  realEstateOperations: [],
  transactionBand: "",
  entityType: "",
  taxElection: "",
  booksOverTwoMonthsBehind: null,
  runsPayroll: null,
  payrollProvider: "unknown",
  payCadence: "unknown",
  payrollResponsibleParty: "unknown",
  payrollQboIntegrationStatus: "unsure",
  payrollPaymentMethods: ["unknown"],
  payrollContactSource: "",
  payrollContactOwnerId: "owner-1",
  payrollContactFirstName: "",
  payrollContactLastName: "",
  payrollContactEmail: "",
  payrollContactPhone: "",
  numberOfProperties: 0,
  numberOfEntities: 0,
  employeesCount: 0,
  contractorsCount: 0,
  recurringContractorTypes: ["unknown"],
  contractorPayCadence: "unsure",
  hasAdminAssistant: null,
  adminAssistantContactSource: "",
  adminAssistantContactOwnerId: "owner-1",
  adminAssistantFirstName: "",
  adminAssistantLastName: "",
  adminAssistantEmail: "",
  adminAssistantPhone: "",
  bankAccountsCount: 0,
  creditCardsCount: 0,
  unconnectedBankAccountsCount: 0,
  unconnectedCreditCardsCount: 0,
  paymentPlatforms: ["unknown"],
  zeroBalancePlatformCount: 0,
  loansCount: 0,
  vehicleNotesCount: 0,
  linesOfCreditCount: 0,
  unconnectedLinesOfCreditCount: 0,
  banksUsed: ["unknown"],
  banksAllowDelegateAccess: null,
  customerInvoicingMethods: ["unknown"],
  acceptsTipsForContractors: null,
  hasTipsLiabilityAccount: null,
  cleanupStartMonth: `${CURRENT_YEAR}-01`,
  cleanupEndMonth: `${CURRENT_YEAR}-${String(LAST_COMPLETED_MONTH).padStart(2, "0")}`,
  historicalCleanupPeriods: [
    {
      id: `cleanup-${CURRENT_YEAR}`,
      year: CURRENT_YEAR,
      startMonth: 1,
      endMonth: LAST_COMPLETED_MONTH,
      platform: "qbo",
      purchasedOrSoldPropertiesCount: 0,
    },
  ],
  waiveOnboardingFee: false,
  onboardingFeeOverride: null,
  annualSavingsPercent: 20,
  includeConditionalStessaMigration: false,
  includeTaxPreparerCoordinationCall: true,
  includePropertyLevelReportingSetup: false,
  includeDocumentOrganizationSetup: false,
  includeQuarterlyFinancialReview: false,
  includeDoubleHqClientPortal: false,
  includeRealEstateChartOfAccounts: false,
  includeNewQuickBooksFileSetup: false,
  bonusPackageSelections: {
    "stessa-migration": [],
    "tax-preparer-coordination": [],
    "property-reporting-setup": [],
    "document-organization": [],
    "quarterly-review": [],
    "doublehq-client-portal": [],
    "real-estate-chart-of-accounts": [],
    "new-quickbooks-file": [],
    "per-property-class-tracking": ["grow", "improve"],
  },
  offerAdvancedReceiptManagement: false,
  advancedReceiptManagementPriceOverride: null,
  offerProjectTracking: false,
  projectTrackingPriceOverride: null,
  offerBudgetReporting: false,
  budgetReportingPriceOverride: null,
  offerSalesTaxFiling: false,
  salesTaxFilingPriceOverride: null,
  includeRegisteredAgentService: false,
  additionalOptions: [],
  bonuses: [],
  optionsCatalogOrder: [],
  featuredImageUrl: "",
  featuredVideoUrl: "",
  featuredMediaId: "",
  introHeadline: "",
  introBody: "",
  heroMediaButton: DEFAULT_HERO_MEDIA_BUTTON,
  heroContinueButton: DEFAULT_HERO_CONTINUE_BUTTON,
  urgencyOffer: DEFAULT_URGENCY_OFFER,
  proposalTheme: DEFAULT_PROPOSAL_THEME_ID,
  proposalMode: DEFAULT_PROPOSAL_MODE,
  ongoingBookkeepingPlatform: "qbo",
  platformMigrationEnabled: false,
  platformMigrationEffectiveMonth: "",
  cleanupPurchasedOrSoldPropertiesCount: 0,
  discretionaryMultiplier: 1,
  discretionaryMultiplierNote: "",
  currentBookkeepingStatus: "",
  assessmentNotes: "",
  qboAccessStatus: "not_requested",
};

const ADVANCED_RECEIPT_MANAGEMENT_PRICING: Record<TransactionBand, number> = {
  "": 180,
  "0-99": 99,
  "100-499": 499,
  "500-999": 999,
  "1000+": 1000,
  unknown: 180,
};

export function getAdvancedReceiptManagementPrice(assessment: AssessmentState) {
  const minimumPrice = ADVANCED_RECEIPT_MANAGEMENT_PRICING[assessment.transactionBand];
  return assessment.advancedReceiptManagementPriceOverride === null
    ? minimumPrice
    : Math.max(minimumPrice, assessment.advancedReceiptManagementPriceOverride);
}

export function getProjectTrackingPrice(assessment: AssessmentState) {
  return assessment.projectTrackingPriceOverride ?? 150;
}

export function getBudgetReportingPrice(assessment: AssessmentState) {
  return assessment.budgetReportingPriceOverride ?? 150;
}

export function getSalesTaxFilingPrice(assessment: AssessmentState) {
  return assessment.salesTaxFilingPriceOverride ?? 650;
}

function catalogOptionPrice(item: ProposalOptionCatalogItem, assessment: AssessmentState) {
  if (item.offerKey === "advanced-receipt-management") return getAdvancedReceiptManagementPrice(assessment);
  if (item.offerKey === "project-tracking") return getProjectTrackingPrice(assessment);
  if (item.offerKey === "budget-reporting") return getBudgetReportingPrice(assessment);
  if (item.offerKey === "sales-tax-filing") return getSalesTaxFilingPrice(assessment);
  return item.defaultPrice;
}

function catalogOptionSelected(item: ProposalOptionCatalogItem, assessment: AssessmentState) {
  const legacySelections: Record<string, boolean> = {
    "advanced-receipt-management": assessment.offerAdvancedReceiptManagement,
    "project-tracking": assessment.offerProjectTracking,
    "budget-reporting": assessment.offerBudgetReporting,
    "sales-tax-filing": assessment.offerSalesTaxFiling,
    "tax-preparer-coordination": assessment.includeTaxPreparerCoordinationCall,
    "registered-agent-service": assessment.includeRegisteredAgentService,
  };
  return legacySelections[item.offerKey] ?? true;
}

export function getProposalAdditionalOptions(
  assessment: AssessmentState,
  catalogItems: ProposalOptionCatalogItem[] = [],
): ProposalAdditionalOption[] {
  if (assessment.additionalOptions.length > 0) return assessment.additionalOptions;
  const catalogOptions = catalogItems.filter((item) => item.defaultInclusion === "optional");
  if (catalogOptions.length > 0) {
    return catalogOptions.map((item) => ({
      id: item.offerKey,
      name: item.name,
      description: item.description,
      monthlyPrice: catalogOptionPrice(item, assessment),
      showInProposal: catalogOptionSelected(item, assessment),
      archived: false,
      realEstateSpecific: item.realEstateSpecific,
    }));
  }

  return [
    { id: "advanced-receipt-management", name: "Advanced Receipt Management", description: "Enhanced receipt collection, organization, and matching support.", monthlyPrice: getAdvancedReceiptManagementPrice(assessment), showInProposal: assessment.offerAdvancedReceiptManagement, archived: false },
    { id: "project-tracking", name: "Project Tracking", description: "Income, cost, and profitability tracking for Improve and Grow.", monthlyPrice: getProjectTrackingPrice(assessment), showInProposal: assessment.offerProjectTracking, archived: false },
    { id: "budget-reporting", name: "Budget Setup & Budget vs. Actuals Reporting", description: "Build the client’s budget and provide recurring budget-versus-actuals reporting.", monthlyPrice: getBudgetReportingPrice(assessment), showInProposal: assessment.offerBudgetReporting, archived: false },
    { id: "sales-tax-filing", name: "Sales Tax Filing & Remittance", description: "Calculate, file, and remit the client’s sales tax payments.", monthlyPrice: getSalesTaxFilingPrice(assessment), showInProposal: assessment.offerSalesTaxFiling, archived: false },
    { id: "tax-preparer-coordination", name: "Tax Preparer Coordination", description: "Coordinate with the client’s tax preparer and provide organized bookkeeping records.", monthlyPrice: 0, showInProposal: assessment.includeTaxPreparerCoordinationCall, archived: false },
    { id: "registered-agent-service", name: "Registered Agent Service", description: "Forward official state correspondence to the designated contact.", monthlyPrice: 0, showInProposal: assessment.includeRegisteredAgentService, archived: false },
  ];
}

const DEFAULT_PROPOSAL_BONUSES: ProposalBonus[] = [
  { id: "stessa-migration", name: "QuickBooks to Stessa Migration", description: "We will move the client's books to Stessa for free when they buy the cleanup and monthly bookkeeping in this offer.", archived: false, realEstateSpecific: true },
  { id: "property-reporting-setup", name: "Reports by Property", description: "We will set up the books so the client can see income and costs for each property.", archived: false, realEstateSpecific: true },
  { id: "document-organization", name: "Organized, Audit-Ready Records", description: "We replace paper files and loose digital files with one clear system. The client uploads records to the portal. We organize them and link them to the right items in the books.", archived: false },
  { id: "quarterly-review", name: "First Quarterly Review", description: "After the first full quarter, we will meet with the client to review reports, answer questions, and plan the next steps.", archived: false },
  { id: "doublehq-client-portal", name: "DoubleHQ Client Portal", description: "The client gets one online place to talk with our team, send files, view requests, and check the work in progress.", archived: false },
  { id: "real-estate-chart-of-accounts", name: "Real Estate Chart of Accounts", description: "We will add our real estate Chart of Accounts to the client's current QuickBooks file. This makes reports easier to read and keeps the books consistent.", archived: false, realEstateSpecific: true },
  { id: "new-quickbooks-file", name: "New QuickBooks Setup", description: "If a fresh start is best, we will build a new QuickBooks file for monthly bookkeeping. It will include our Real Estate Chart of Accounts.", archived: false, realEstateSpecific: true },
  { id: "per-property-class-tracking", name: "Per-Property Class Tracking", description: "Track income and expenses by property using classes for property-level reporting.", archived: false, realEstateSpecific: true, billingCadence: "monthly" },
];

export function getProposalBonuses(
  assessment: AssessmentState,
  catalogItems: ProposalOptionCatalogItem[] = [],
): ProposalBonus[] {
  const catalogBonuses = catalogItems.filter((item) => item.defaultInclusion === "included");
  const mapCatalogBonus = (item: ProposalOptionCatalogItem): ProposalBonus => ({
    id: item.offerKey,
    name: item.name,
    description: item.description,
    archived: false,
    realEstateSpecific: item.realEstateSpecific,
    billingCadence: item.billingCadence === "monthly" ? "monthly" : "one-time",
    defaultPackageIds: item.defaultPackageIds,
  });
  if (assessment.bonuses.length > 0 || assessment.additionalOptions.length > 0) {
    const existingIds = new Set([
      ...assessment.bonuses.map((item) => item.id),
      ...assessment.additionalOptions.map((item) => item.id),
    ]);
    const newlyCatalogedCoreServices = catalogBonuses
      .filter((item) => item.offerSection === "core-services" && !existingIds.has(item.offerKey))
      .map(mapCatalogBonus);
    return [...assessment.bonuses, ...newlyCatalogedCoreServices];
  }
  if (catalogBonuses.length > 0) {
    return catalogBonuses.map(mapCatalogBonus);
  }
  return DEFAULT_PROPOSAL_BONUSES;
}

export function getOptionsCatalogOrder(
  assessment: AssessmentState,
  catalogItems: ProposalOptionCatalogItem[] = [],
): string[] {
  const optionIds = getProposalAdditionalOptions(assessment, catalogItems).map((item) => item.id);
  const bonusIds = getProposalBonuses(assessment, catalogItems).map((item) => item.id);
  const known = new Set([...optionIds, ...bonusIds]);
  const stored = assessment.optionsCatalogOrder.filter((id) => known.has(id));
  const missing = [...optionIds, ...bonusIds].filter((id) => !stored.includes(id));
  return [...stored, ...missing];
}

const PACKAGES: PackageDefinition[] = [
  {
    id: "grow",
    name: "Grow",
    monthlyPrice: 250,
    description:
      "Includes everything in Improve, plus concierge support, CFO-level reporting, faster turnaround, and more proactive financial guidance.",
    includedServices: [
      "Everything in Improve",
      "Concierge support",
      "CFO-level reporting",
      "Faster turnaround",
      "Proactive advisory guidance",
      "Dedicated coordination",
    ],
    accentClass: "text-emerald-600",
    icon: Sparkles,
    clientFit:
      "Best for owners who want high-touch support, executive-level visibility, and a more strategic finance partner.",
    pricing: {
      recurringPerProperty: 50,
      recurringPerEntity: 175,
      recurringComplexity: { standard: 0, complex: 275, advanced: 600 },
      transactionBandMonthly: { "0-99": 0, "100-499": 120, "500-999": 260, "1000+": 480, unknown: 0 },
      staffingPerPerson: 60,
      reconciliationThresholds: [
        { min: 6, amount: 90 },
        { min: 12, amount: 180 },
        { min: 20, amount: 320 },
      ],
      platformThresholds: [
        { min: 1, amount: 70 },
        { min: 3, amount: 140 },
      ],
      passThroughThresholds: [
        { min: 1, amount: 85 },
        { min: 3, amount: 170 },
      ],
      mixedBooksMonthly: 225,
      nonReBusinessMonthly: 325,
      complexOperationsMonthly: 190,
      multiOperationMonthly: 110,
      backlogPerProperty: 40,
      backlogPerEntity: 100,
      catchUpComplexityMultiplier: { standard: 0, complex: 0.2, advanced: 0.35 },
    },
  },
  {
    id: "improve",
    name: "Improve",
    monthlyPrice: 250,
    description:
      "Includes everything in Maintain, plus budgeting, advanced reporting, A/R and A/P reporting visibility, and stronger operating insight.",
    includedServices: [
      "Everything in Maintain",
      "Budgeting support",
      "Advanced reporting",
      "A/R reporting visibility",
      "A/P reporting visibility",
      "Priority communication",
    ],
    accentClass: "text-indigo-600",
    icon: TrendingUp,
    clientFit:
      "Best for most investors who want stronger visibility, better operating support, and more confidence in the numbers.",
    pricing: {
      recurringPerProperty: 50,
      recurringPerEntity: 125,
      recurringComplexity: { standard: 0, complex: 200, advanced: 450 },
      transactionBandMonthly: { "0-99": 0, "100-499": 90, "500-999": 200, "1000+": 360, unknown: 0 },
      staffingPerPerson: 45,
      reconciliationThresholds: [
        { min: 6, amount: 70 },
        { min: 12, amount: 140 },
        { min: 20, amount: 260 },
      ],
      platformThresholds: [
        { min: 1, amount: 55 },
        { min: 3, amount: 110 },
      ],
      passThroughThresholds: [
        { min: 1, amount: 65 },
        { min: 3, amount: 140 },
      ],
      mixedBooksMonthly: 175,
      nonReBusinessMonthly: 250,
      complexOperationsMonthly: 150,
      multiOperationMonthly: 90,
      backlogPerProperty: 30,
      backlogPerEntity: 75,
      catchUpComplexityMultiplier: { standard: 0, complex: 0.15, advanced: 0.25 },
    },
  },
  {
    id: "maintain",
    name: "Maintain",
    monthlyPrice: 250,
    description:
      "Core monthly bookkeeping, reconciliations, and clean monthly financials for owners who want reliable books and a steady close process.",
    includedServices: [
      "Monthly bookkeeping",
      "Account reconciliation",
      "Monthly financial statements",
      "Core real-estate reporting",
      "Core loan accounting",
      "Standard support",
    ],
    accentClass: "text-amber-600",
    icon: ShieldCheck,
    clientFit:
      "Best for owners who need a reliable monthly close, clean books, and a simpler ongoing support structure.",
    pricing: {
      recurringPerProperty: 50,
      recurringPerEntity: 100,
      recurringComplexity: { standard: 0, complex: 150, advanced: 350 },
      transactionBandMonthly: { "0-99": 0, "100-499": 70, "500-999": 150, "1000+": 280, unknown: 0 },
      staffingPerPerson: 35,
      reconciliationThresholds: [
        { min: 6, amount: 50 },
        { min: 12, amount: 110 },
        { min: 20, amount: 200 },
      ],
      platformThresholds: [
        { min: 1, amount: 40 },
        { min: 3, amount: 80 },
      ],
      passThroughThresholds: [
        { min: 1, amount: 50 },
        { min: 3, amount: 110 },
      ],
      mixedBooksMonthly: 130,
      nonReBusinessMonthly: 200,
      complexOperationsMonthly: 120,
      multiOperationMonthly: 70,
      backlogPerProperty: 20,
      backlogPerEntity: 50,
      catchUpComplexityMultiplier: { standard: 0, complex: 0.1, advanced: 0.2 },
    },
  },
];

const MAINTAIN_PACKAGE = PACKAGES.find((pkg) => pkg.id === "maintain") as PackageDefinition;

const INPUT_CLASS_NAME =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-brandnavy focus:outline-none focus:ring-2 focus:ring-brandnavy/10";
const FIELD_LABEL_CLASS =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500";


export const BOOK_SET_OPTIONS: Array<{ value: BookSetType; label: string; description: string }> = [
  {
    value: "",
    label: "Select...",
    description: "",
  },
  {
    value: "real-estate-only",
    label: "Real estate books only",
    description: "The books are primarily for real estate ownership or operations.",
  },
  {
    value: "mixed-books",
    label: "Real estate + other",
    description: "The books combine real estate activity with another operating business or side activity.",
  },
  {
    value: "other-business",
    label: "Non-RE business",
    description: "The books are not primarily real-estate books.",
  },
  {
    value: "unknown",
    label: "Unknown",
    description: "The primary activity in the books has not been confirmed yet.",
  },
];

export const QBO_ACCESS_STATUS_OPTIONS: Array<{
  value: QboAccessStatus;
  label: string;
}> = [
  {
    value: "not_requested",
    label: "Not yet invited",
  },
  {
    value: "requested_not_received",
    label: "Invited — awaiting acceptance",
  },
  {
    value: "invite_received_review_not_completed",
    label: "Accepted — pending file review",
  },
  {
    value: "review_completed",
    label: "File reviewed",
  },
  {
    value: "unknown",
    label: "Unknown",
  },
];

export const REAL_ESTATE_OPERATIONS: Array<{ value: RealEstateOperation; label: string }> = [
  { value: "buy-hold", label: "Buy and hold" },
  { value: "long-term-rentals", label: "Long-term rentals" },
  { value: "short-term-rentals", label: "Short-term rentals" },
  { value: "flips", label: "Flips" },
  { value: "land", label: "Land" },
  { value: "development", label: "Development" },
  { value: "unknown", label: "Unknown" },
];

const GROW_PRICE_MULTIPLIER_FROM_MAINTAIN = 1.5;

const TRANSACTION_BANDS: Array<{ value: TransactionBand; label: string; score: number }> = [
  { value: "", label: "Select...", score: 0 },
  { value: "0-99", label: "0-99 / month", score: 0 },
  { value: "100-499", label: "100-499 / month", score: 1 },
  { value: "500-999", label: "500-999 / month", score: 2 },
  { value: "1000+", label: "1000+ / month", score: 3 },
  { value: "unknown", label: "Unknown", score: 0 },
];

export const ENTITY_TYPE_OPTIONS: Array<{ value: EntityType; label: string }> = [
  { value: "", label: "Select..." },
  { value: "llc", label: "LLC" },
  { value: "s-corp", label: "S Corp" },
  { value: "c-corp", label: "C Corp" },
  { value: "partnership", label: "Partnership" },
  { value: "sole-proprietor", label: "Sole proprietor" },
  { value: "trust", label: "Trust" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Unknown" },
];

export const TAX_ELECTION_OPTIONS: Array<{ value: TaxElection; label: string }> = [
  { value: "", label: "Select..." },
  { value: "disregarded", label: "Disregarded" },
  { value: "partnership", label: "Partnership" },
  { value: "s-corp", label: "S Corp" },
  { value: "c-corp", label: "C Corp" },
  { value: "trust-estate", label: "Trust / estate" },
  { value: "unknown", label: "Unknown" },
];

const PAYROLL_PROVIDER_OPTIONS: Array<{ value: PayrollProvider; label: string }> = [
  { value: "", label: "Select..." },
  { value: "gusto", label: "Gusto" },
  { value: "quickbooks-payroll", label: "QuickBooks Payroll" },
  { value: "adp", label: "ADP" },
  { value: "paychex", label: "Paychex" },
  { value: "rippling", label: "Rippling" },
  { value: "justworks", label: "Justworks" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Unknown" },
];

const PAY_CADENCE_OPTIONS: Array<{ value: PayCadence; label: string }> = [
  { value: "", label: "Select..." },
  { value: "weekly", label: "Weekly" },
  { value: "every-other-week", label: "Every other week" },
  { value: "twice-a-month", label: "Twice a month" },
  { value: "monthly", label: "Monthly" },
  { value: "unknown", label: "Unknown" },
];

const PAYROLL_RESPONSIBLE_PARTY_OPTIONS: Array<{
  value: PayrollResponsibleParty;
  label: string;
}> = [
  { value: "", label: "Select..." },
  { value: "owner", label: "Owner (does it themselves)" },
  { value: "admin-assistant", label: "Admin Assistant / Office Staff" },
  { value: "internal-bookkeeper", label: "Internal Bookkeeper / Controller" },
  { value: "payroll-provider-managed", label: "Payroll Provider (Full-Service / Managed)" },
  { value: "outsourced-accountant", label: "Outsourced Accountant / CPA" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Unknown" },
];

const PAYROLL_QBO_INTEGRATION_STATUS_OPTIONS: Array<{
  value: PayrollQboIntegrationStatus;
  label: string;
  description: string;
}> = [
  { value: "", label: "Select...", description: "" },
  {
    value: "fully-integrated",
    label: "Yes — fully integrated",
    description: "Journal entries sync automatically from the payroll provider into QBO.",
  },
  {
    value: "partially-integrated",
    label: "Partially — some manual entry",
    description: "Some payroll JEs sync automatically, but part of the process still needs manual entry.",
  },
  {
    value: "not-integrated",
    label: "No — not integrated",
    description: "Payroll JEs are entered manually each pay period.",
  },
  {
    value: "unsure",
    label: "Unsure / needs review",
    description: "",
  },
];

const PAYROLL_PAYMENT_METHOD_OPTIONS: Array<{ value: PayrollPaymentMethod; label: string }> = [
  { value: "direct-deposit", label: "Direct Deposit" },
  { value: "paper-check", label: "Paper Check" },
  { value: "cash", label: "Cash" },
  { value: "venmo", label: "Venmo" },
  { value: "zelle", label: "Zelle" },
  { value: "cash-app", label: "Cash App" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Unknown" },
];

const PAYMENT_PLATFORM_OPTIONS: Array<{ value: PaymentPlatform; label: string }> = [
  { value: "paypal", label: "PayPal" },
  { value: "cash-app", label: "Cash App" },
  { value: "venmo", label: "Venmo" },
  { value: "stripe", label: "Stripe" },
  { value: "airbnb-payouts", label: "Airbnb Payouts" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Unknown" },
];

const CONTRACTOR_TYPE_OPTIONS: Array<{ value: ContractorType; label: string }> = [
  { value: "cleaner", label: "Cleaner / Turnover" },
  { value: "landscaping", label: "Landscaping / Lawn Care" },
  { value: "handyman", label: "Handyman" },
  { value: "hvac", label: "HVAC" },
  { value: "plumber", label: "Plumber" },
  { value: "electrician", label: "Electrician" },
  { value: "pest-control", label: "Pest Control" },
  { value: "pool-service", label: "Pool Service" },
  { value: "snow-removal", label: "Snow Removal" },
  { value: "property-manager", label: "Property Manager" },
  { value: "locksmith", label: "Locksmith" },
  { value: "painter", label: "Painter" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Unknown" },
];

const CONTRACTOR_PAY_CADENCE_OPTIONS: Array<{
  value: ContractorPayCadence;
  label: string;
  description: string;
}> = [
  { value: "", label: "Select...", description: "" },
  {
    value: "regular-schedule",
    label: "Regular Schedule",
    description: "Contractors are paid on a set recurring cadence, similar to payroll.",
  },
  {
    value: "per-job-milestone",
    label: "Per Job / Milestone",
    description: "Contractors are paid as individual jobs or milestones are completed.",
  },
  {
    value: "mixed",
    label: "Mix of Both",
    description: "Some contractors are on a regular schedule, others are paid per job.",
  },
  { value: "unsure", label: "Unsure / Needs Review", description: "" },
];

const CONTACT_SOURCE_OPTIONS: Array<{ value: ContactSourceType; label: string }> = [
  { value: "", label: "Select..." },
  { value: "primary-contact", label: "Same as Primary Contact" },
  { value: "business-owner", label: "Business Owner" },
  { value: "custom", label: "Someone Else" },
];

const CUSTOMER_INVOICING_METHOD_OPTIONS: Array<{ value: CustomerInvoicingMethod; label: string }> = [
  { value: "appfolio", label: "AppFolio" },
  { value: "buildium", label: "Buildium" },
  { value: "rentec-direct", label: "Rentec Direct" },
  { value: "tenantcloud", label: "TenantCloud" },
  { value: "quickbooks-invoicing", label: "QuickBooks Invoicing" },
  { value: "paypal", label: "PayPal" },
  { value: "venmo", label: "Venmo" },
  { value: "zelle", label: "Zelle" },
  { value: "cash-app", label: "Cash App" },
  { value: "check-mail", label: "Check / Mail" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Unknown" },
];

const BANK_OPTIONS: Array<{ value: BankOption; label: string }> = [
  { value: "chase", label: "Chase" },
  { value: "bank-of-america", label: "Bank of America" },
  { value: "wells-fargo", label: "Wells Fargo" },
  { value: "us-bank", label: "US Bank" },
  { value: "pnc", label: "PNC" },
  { value: "truist", label: "Truist" },
  { value: "regions", label: "Regions" },
  { value: "fifth-third", label: "Fifth Third Bank" },
  { value: "mercury", label: "Mercury" },
  { value: "novo", label: "Novo" },
  { value: "relay", label: "Relay" },
  { value: "bluevine", label: "Bluevine" },
  { value: "grasshopper", label: "Grasshopper Bank" },
  { value: "local-community-bank", label: "Local / Community Bank" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Unknown" },
];

export function formatCurrency(value: number, suffix = "") {
  return `$${value.toLocaleString("en-US")}${suffix}`;
}

function renderPricingBreakdownRows(items: MonthlyRateBreakdownItem[], keyPrefix: string) {
  return items.map((item, index) => (
    <div
      key={`${keyPrefix}-${item.label}`}
      className={`proposal-builder-breakdown-card flex items-center justify-between gap-4 py-2 text-sm ${
        index === 0 ? "border-t border-slate-200" : ""
      }`}
    >
      <span className="px-5 text-slate-600">{item.label}</span>
      <span className="px-5 font-medium text-slate-900">{formatCurrency(item.amount)}</span>
    </div>
  ));
}

function calculateInclusiveMonths(startMonth: string, endMonth: string) {
  if (!startMonth || !endMonth) return 0;

  const [startYear, startMonthNumber] = startMonth.split("-").map(Number);
  const [endYear, endMonthNumber] = endMonth.split("-").map(Number);

  if (
    !Number.isFinite(startYear) ||
    !Number.isFinite(startMonthNumber) ||
    !Number.isFinite(endYear) ||
    !Number.isFinite(endMonthNumber)
  ) {
    return 0;
  }

  const startIndex = startYear * 12 + (startMonthNumber - 1);
  const endIndex = endYear * 12 + (endMonthNumber - 1);

  if (endIndex < startIndex) return 0;

  return endIndex - startIndex + 1;
}

function countValue(value: CountValue) {
  return typeof value === "number" ? value : 0;
}

function resolveContactSourceValues(
  source: ContactSourceType,
  ownerId: string,
  custom: { firstName: string; lastName: string; email: string; phone: string },
  contactInfo: ContactInfoState,
) {
  if (source === "primary-contact") {
    return resolvePrimaryContact(contactInfo);
  }

  if (source === "business-owner") {
    const owner = contactInfo.owners.find((item) => item.id === ownerId);
    return {
      firstName: owner?.firstName ?? "",
      lastName: owner?.lastName ?? "",
      email: owner?.email ?? "",
      phone: owner?.phone ?? "",
    };
  }

  return custom;
}

function parseCountInput(value: string): CountValue {
  return value === "" ? "" : Number(value) || 0;
}

function parseMultiplierInput(value: string) {
  if (value === "") return 1;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;

  return Math.max(0, parsed);
}

export const DEFAULT_ANNUAL_SAVINGS_PERCENT = 20;
export const ONBOARDING_BASE_FEE = 500;
export const ONBOARDING_FEE_PER_CLEANUP_MONTH = 20;

export function getCleanupMonthCount(assessment: Pick<AssessmentState, "historicalCleanupPeriods">) {
  return assessment.historicalCleanupPeriods.reduce(
    (total, period) => total + Math.max(0, period.endMonth - period.startMonth + 1),
    0,
  );
}

export function getStandardOnboardingFee(cleanupMonths: number) {
  return ONBOARDING_BASE_FEE + cleanupMonths * ONBOARDING_FEE_PER_CLEANUP_MONTH;
}

export function getListedOnboardingFee(
  assessment: Pick<AssessmentState, "onboardingFeeOverride" | "historicalCleanupPeriods">,
  cleanupMonths = getCleanupMonthCount(assessment),
) {
  if (assessment.onboardingFeeOverride !== null && assessment.onboardingFeeOverride > 0) {
    return assessment.onboardingFeeOverride;
  }

  return getStandardOnboardingFee(cleanupMonths);
}

export function getAnnualSavingsPercent(assessment: Pick<AssessmentState, "annualSavingsPercent">) {
  const value = assessment.annualSavingsPercent;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_ANNUAL_SAVINGS_PERCENT;
  }

  return Math.min(100, Math.max(0, value));
}

function parseAnnualSavingsPercentInput(value: string) {
  if (value === "") return 0;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_ANNUAL_SAVINGS_PERCENT;

  return Math.min(100, Math.max(0, parsed));
}

function roundUpToNearestIncrement(value: number, increment = 5) {
  if (!Number.isFinite(value) || increment <= 0) return value;
  return Math.ceil(value / increment) * increment;
}

function withComplexityUnknownDefaults(assessment: AssessmentState): AssessmentState {
  return {
    ...assessment,
    payrollProvider: assessment.payrollProvider || "unknown",
    payCadence: assessment.payCadence || "unknown",
    payrollResponsibleParty: assessment.payrollResponsibleParty || "unknown",
    payrollQboIntegrationStatus: assessment.payrollQboIntegrationStatus || "unsure",
    contractorPayCadence: assessment.contractorPayCadence || "unsure",
    paymentPlatforms: assessment.paymentPlatforms.length ? assessment.paymentPlatforms : ["unknown"],
    payrollPaymentMethods: assessment.payrollPaymentMethods.length ? assessment.payrollPaymentMethods : ["unknown"],
    recurringContractorTypes: assessment.recurringContractorTypes.length ? assessment.recurringContractorTypes : ["unknown"],
    customerInvoicingMethods: assessment.customerInvoicingMethods.length ? assessment.customerInvoicingMethods : ["unknown"],
    banksUsed: assessment.banksUsed.length ? assessment.banksUsed : ["unknown"],
  };
}

function readStoredAssessment(
  storageKey: string,
  initialAssessment?: Partial<AssessmentState>,
  readStorage = true,
): AssessmentState {
  const initialState = {
    ...INITIAL_ASSESSMENT,
    ...initialAssessment,
    annualSavingsPercent: getAnnualSavingsPercent({
      annualSavingsPercent:
        typeof initialAssessment?.annualSavingsPercent === "number"
          ? initialAssessment.annualSavingsPercent
          : INITIAL_ASSESSMENT.annualSavingsPercent,
    }),
  };

  if (typeof window === "undefined" || !readStorage) {
    return withComplexityUnknownDefaults(initialState);
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return withComplexityUnknownDefaults(initialState);

    const parsed = JSON.parse(raw) as Partial<AssessmentState>;
    return withComplexityUnknownDefaults({
      ...initialState,
      ...parsed,
      annualSavingsPercent: getAnnualSavingsPercent({
        annualSavingsPercent:
          typeof parsed.annualSavingsPercent === "number"
            ? parsed.annualSavingsPercent
            : initialState.annualSavingsPercent,
      }),
      realEstateOperations: Array.isArray(parsed.realEstateOperations)
        ? parsed.realEstateOperations
        : initialState.realEstateOperations,
      paymentPlatforms: Array.isArray(parsed.paymentPlatforms)
        ? parsed.paymentPlatforms
        : initialState.paymentPlatforms,
      recurringContractorTypes: Array.isArray(parsed.recurringContractorTypes)
        ? parsed.recurringContractorTypes
        : initialState.recurringContractorTypes,
      customerInvoicingMethods: Array.isArray(parsed.customerInvoicingMethods)
        ? parsed.customerInvoicingMethods
        : initialState.customerInvoicingMethods,
      banksUsed: Array.isArray(parsed.banksUsed)
        ? parsed.banksUsed
        : initialState.banksUsed,
      payrollPaymentMethods: Array.isArray(parsed.payrollPaymentMethods)
        ? parsed.payrollPaymentMethods
        : initialState.payrollPaymentMethods,
      historicalCleanupPeriods: Array.isArray(parsed.historicalCleanupPeriods)
        ? parsed.historicalCleanupPeriods
        : initialState.historicalCleanupPeriods,
      optionsCatalogOrder: Array.isArray(parsed.optionsCatalogOrder)
        ? parsed.optionsCatalogOrder.filter((id): id is string => typeof id === "string")
        : initialState.optionsCatalogOrder,
      heroMediaButton: normalizeHeroButton(parsed.heroMediaButton, initialState.heroMediaButton),
      heroContinueButton: normalizeHeroButton(
        parsed.heroContinueButton,
        initialState.heroContinueButton,
      ),
      urgencyOffer: normalizeUrgencyOffer(parsed.urgencyOffer),
    });
  } catch {
    return withComplexityUnknownDefaults(initialState);
  }
}

export function hasCatchUpPricingInputs(assessment: AssessmentState) {
  return (
    assessment.booksOverTwoMonthsBehind === true &&
    Boolean(assessment.cleanupStartMonth && assessment.cleanupEndMonth)
  );
}

export function useProposalAssessmentDemoState({
  engagementId,
  initialAssessment,
  persist = true,
}: {
  engagementId?: string;
  initialAssessment?: Partial<AssessmentState>;
  persist?: boolean;
} = {}) {
  const resolvedScopeId =
    engagementId ??
    (typeof window !== "undefined"
      ? (() => {
          const params = new URLSearchParams(window.location.search);
          return params.get("engagementId") ?? params.get("offer") ?? params.get("contacts") ?? params.get("contact") ?? undefined;
        })()
      : undefined);
  const storageKey = resolvedScopeId
    ? `${ASSESSMENT_STORAGE_KEY}:${resolvedScopeId}`
    : ASSESSMENT_STORAGE_KEY;
  const [assessment, setAssessment] = useState<AssessmentState>(() =>
    readStoredAssessment(storageKey, initialAssessment, false),
  );
  const [storageReady, setStorageReady] = useState(!persist);

  useEffect(() => {
    if (!persist) return;
    const timeoutId = window.setTimeout(() => {
      setAssessment(readStoredAssessment(storageKey, initialAssessment, true));
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [initialAssessment, persist, storageKey]);

  useEffect(() => {
    if (!persist || !storageReady) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(assessment));
    } catch {
      // Ignore localStorage failures in demo mode.
    }
  }, [assessment, persist, storageKey, storageReady]);

  function updateAssessment<Key extends keyof AssessmentState>(
    key: Key,
    value: AssessmentState[Key],
  ) {
    setAssessment((current) => ({ ...current, [key]: value }));
  }

  function toggleOperation(operation: RealEstateOperation) {
    setAssessment((current) => {
      const exists = current.realEstateOperations.includes(operation);
      return {
        ...current,
        realEstateOperations: exists
          ? current.realEstateOperations.filter((item) => item !== operation)
          : operation === "unknown"
            ? ["unknown"]
            : [...current.realEstateOperations.filter((item) => item !== "unknown"), operation],
      };
    });
  }

  function togglePaymentPlatform(platform: PaymentPlatform) {
    setAssessment((current) => {
      const exists = current.paymentPlatforms.includes(platform);
      return {
        ...current,
        paymentPlatforms: exists
          ? current.paymentPlatforms.length === 1 ? ["unknown"] : current.paymentPlatforms.filter((item) => item !== platform)
          : platform === "unknown"
            ? ["unknown"]
            : [...current.paymentPlatforms.filter((item) => item !== "unknown"), platform],
      };
    });
  }

  function toggleContractorType(contractorType: ContractorType) {
    setAssessment((current) => {
      const exists = current.recurringContractorTypes.includes(contractorType);
      return {
        ...current,
        recurringContractorTypes: exists
          ? current.recurringContractorTypes.length === 1 ? ["unknown"] : current.recurringContractorTypes.filter((item) => item !== contractorType)
          : contractorType === "unknown"
            ? ["unknown"]
            : [...current.recurringContractorTypes.filter((item) => item !== "unknown"), contractorType],
      };
    });
  }

  function toggleCustomerInvoicingMethod(method: CustomerInvoicingMethod) {
    setAssessment((current) => {
      const exists = current.customerInvoicingMethods.includes(method);
      return {
        ...current,
        customerInvoicingMethods: exists
          ? current.customerInvoicingMethods.length === 1 ? ["unknown"] : current.customerInvoicingMethods.filter((item) => item !== method)
          : method === "unknown"
            ? ["unknown"]
            : [...current.customerInvoicingMethods.filter((item) => item !== "unknown"), method],
      };
    });
  }

  function toggleBankUsed(bank: BankOption) {
    setAssessment((current) => {
      const exists = current.banksUsed.includes(bank);
      return {
        ...current,
        banksUsed: exists
          ? current.banksUsed.length === 1 ? ["unknown"] : current.banksUsed.filter((item) => item !== bank)
          : bank === "unknown"
            ? ["unknown"]
            : [...current.banksUsed.filter((item) => item !== "unknown"), bank],
      };
    });
  }

  function togglePayrollPaymentMethod(method: PayrollPaymentMethod) {
    setAssessment((current) => {
      const exists = current.payrollPaymentMethods.includes(method);
      return {
        ...current,
        payrollPaymentMethods: exists
          ? current.payrollPaymentMethods.length === 1 ? ["unknown"] : current.payrollPaymentMethods.filter((item) => item !== method)
          : method === "unknown"
            ? ["unknown"]
            : [...current.payrollPaymentMethods.filter((item) => item !== "unknown"), method],
      };
    });
  }

  function resetAssessment() {
    setAssessment(INITIAL_ASSESSMENT);
  }

  return {
    assessment,
    setAssessment,
    storageReady,
    updateAssessment,
    toggleOperation,
    togglePaymentPlatform,
    toggleContractorType,
    toggleCustomerInvoicingMethod,
    toggleBankUsed,
    togglePayrollPaymentMethod,
    resetAssessment,
  };
}

function transactionBandScore(band: TransactionBand) {
  return TRANSACTION_BANDS.find((option) => option.value === band)?.score ?? 0;
}

function amountForThreshold(value: number, thresholds: ThresholdAmount) {
  return thresholds.reduce((current, threshold) => {
    return value >= threshold.min ? threshold.amount : current;
  }, 0);
}

function hasComplexRealEstateOperations(assessment: AssessmentState) {
  return (
    assessment.realEstateOperations.includes("short-term-rentals") ||
    assessment.realEstateOperations.includes("flips") ||
    assessment.realEstateOperations.includes("development")
  );
}

function hasMonthlyPricingInputs(assessment: AssessmentState) {
  return Boolean(
    assessment.bookSetType ||
      assessment.transactionBand ||
      assessment.entityType ||
      assessment.taxElection ||
      assessment.booksOverTwoMonthsBehind !== null ||
      assessment.runsPayroll !== null ||
      countValue(assessment.numberOfProperties) > 0 ||
      countValue(assessment.numberOfEntities) > 0 ||
      countValue(assessment.employeesCount) > 0 ||
      countValue(assessment.contractorsCount) > 0 ||
      countValue(assessment.bankAccountsCount) > 0 ||
      countValue(assessment.creditCardsCount) > 0 ||
      countValue(assessment.unconnectedBankAccountsCount) > 0 ||
      countValue(assessment.unconnectedCreditCardsCount) > 0 ||
      countValue(assessment.zeroBalancePlatformCount) > 0 ||
      countValue(assessment.loansCount) > 0 ||
      countValue(assessment.vehicleNotesCount) > 0 ||
      countValue(assessment.linesOfCreditCount) > 0 ||
      countValue(assessment.unconnectedLinesOfCreditCount) > 0 ||
      assessment.realEstateOperations.length > 0 ||
      assessment.paymentPlatforms.length > 0
  );
}

function derivedPricingComplexityLevel(assessment: AssessmentState): DemoComplexityLevel {
  const txScore = transactionBandScore(assessment.transactionBand);
  const headcount = countValue(assessment.employeesCount) + countValue(assessment.contractorsCount);
  const reconciliationCount = reconciliationAccountCount(assessment);
  const platformComplexity = paymentPlatformComplexityCount(assessment);
  const hasComplexOperations = hasComplexRealEstateOperations(assessment);

  let score = 0;
  score += txScore;
  if (countValue(assessment.numberOfProperties) >= 10) score += 2;
  else if (countValue(assessment.numberOfProperties) >= 4) score += 1;
  if (countValue(assessment.numberOfEntities) >= 3) score += 2;
  else if (countValue(assessment.numberOfEntities) >= 2) score += 1;
  if (headcount >= 8) score += 2;
  else if (headcount >= 3) score += 1;
  if (reconciliationCount >= 16) score += 2;
  else if (reconciliationCount >= 8) score += 1;
  if (platformComplexity >= 4) score += 2;
  else if (platformComplexity >= 2) score += 1;
  if (hasComplexOperations) score += 2;
  else if (knownRealEstateOperationCount(assessment) >= 2) score += 1;
  if (assessment.bookSetType === "mixed-books") score += 2;
  if (assessment.bookSetType === "other-business") score += 1;

  if (score >= 9) return "advanced";
  if (score >= 4) return "complex";
  return "standard";
}

function reconciliationAccountCount(assessment: AssessmentState) {
  return (
    countValue(assessment.bankAccountsCount) +
    countValue(assessment.creditCardsCount) +
    countValue(assessment.unconnectedBankAccountsCount) +
    countValue(assessment.unconnectedCreditCardsCount) +
    countValue(assessment.loansCount) +
    countValue(assessment.vehicleNotesCount) +
    countValue(assessment.linesOfCreditCount) +
    countValue(assessment.unconnectedLinesOfCreditCount)
  );
}

function paymentPlatformComplexityCount(assessment: AssessmentState) {
  return (
    assessment.paymentPlatforms.filter((platform) => platform !== "unknown").length +
    countValue(assessment.zeroBalancePlatformCount)
  );
}

function knownRealEstateOperationCount(assessment: AssessmentState) {
  return assessment.realEstateOperations.filter((operation) => operation !== "unknown").length;
}

function knownPaymentPlatformCount(assessment: AssessmentState) {
  return assessment.paymentPlatforms.filter((platform) => platform !== "unknown").length;
}

function getMonthlyRateBreakdown(
  pkg: PackageDefinition,
  assessment: AssessmentState,
  complexityLevel: DemoComplexityLevel,
) {
  const propertyCount = countValue(assessment.numberOfProperties);
  const entityCount = countValue(assessment.numberOfEntities);
  const headcount = countValue(assessment.employeesCount) + countValue(assessment.contractorsCount);
  const reconciliationCount = reconciliationAccountCount(assessment);
  const platformCount = knownPaymentPlatformCount(assessment);
  const passThroughCount = countValue(assessment.zeroBalancePlatformCount);
  const hasComplexOperations = hasComplexRealEstateOperations(assessment);
  const multipleOperations = knownRealEstateOperationCount(assessment) >= 2;
  const transactionBandMonthly = assessment.transactionBand
    ? pkg.pricing.transactionBandMonthly[assessment.transactionBand]
    : 0;
  const staffingAmount = headcount * pkg.pricing.staffingPerPerson;
  const reconciliationAmount = amountForThreshold(
    reconciliationCount,
    pkg.pricing.reconciliationThresholds,
  );
  const platformAmount = amountForThreshold(platformCount, pkg.pricing.platformThresholds);
  const passThroughAmount = amountForThreshold(
    passThroughCount,
    pkg.pricing.passThroughThresholds,
  );
  const booksTypeAmount =
    assessment.bookSetType === "mixed-books"
      ? pkg.pricing.mixedBooksMonthly
      : assessment.bookSetType === "other-business"
        ? pkg.pricing.nonReBusinessMonthly
        : 0;
  const operationsAmount = hasComplexOperations
    ? pkg.pricing.complexOperationsMonthly
    : !hasComplexOperations && multipleOperations
      ? pkg.pricing.multiOperationMonthly
      : 0;
  const baseMonthly =
    pkg.monthlyPrice +
    propertyCount * pkg.pricing.recurringPerProperty +
    entityCount * pkg.pricing.recurringPerEntity +
    pkg.pricing.recurringComplexity[complexityLevel] +
    transactionBandMonthly +
    staffingAmount +
    reconciliationAmount +
    platformAmount +
    passThroughAmount +
    booksTypeAmount +
    operationsAmount;
  const multiplierDeltaAmount =
    Math.round((baseMonthly * assessment.discretionaryMultiplier - baseMonthly) * 100) / 100;

  const baseItems: MonthlyRateBreakdownItem[] = [
    { label: "Base monthly package", amount: pkg.monthlyPrice },
    {
      label: `${propertyCount} properties`,
      amount: propertyCount * pkg.pricing.recurringPerProperty,
    },
    {
      label: `${entityCount} additional entities`,
      amount: entityCount * pkg.pricing.recurringPerEntity,
    },
    {
      label: `Complexity (${complexityLevel})`,
      amount: pkg.pricing.recurringComplexity[complexityLevel],
    },
    { label: "Transaction volume", amount: transactionBandMonthly },
    { label: "Staffing", amount: staffingAmount },
    { label: "Reconciliation load", amount: reconciliationAmount },
    { label: "Connected platforms", amount: platformAmount },
    { label: "Pass-through accounts", amount: passThroughAmount },
    { label: "Books type adjustment", amount: booksTypeAmount },
    { label: "Operations adjustment", amount: operationsAmount },
  ].filter((item) => item.amount > 0);

  const adjustmentItems: MonthlyRateBreakdownItem[] = [
    {
      label: `Discretionary multiplier (${assessment.discretionaryMultiplier.toFixed(2)}x)`,
      amount: multiplierDeltaAmount,
    },
  ].filter((item) => item.amount !== 0);

  return { baseItems, adjustmentItems };
}

function buildPackagePricing(
  pkg: PackageDefinition,
  assessment: AssessmentState,
  cleanupMonths: number,
  manualAdjustmentAmount: number,
): PackagePricingSummary {
  const complexityLevel = derivedPricingComplexityLevel(assessment);
  const propertyCount = countValue(assessment.numberOfProperties);
  const entityCount = countValue(assessment.numberOfEntities);
  const reconciliationCount = reconciliationAccountCount(assessment);
  const hasYearSpecificPropertyCounts = assessment.historicalCleanupPeriods.some(
    (period) => period.purchasedOrSoldPropertiesCount !== undefined,
  );
  const cleanupPurchasedOrSoldPropertiesCount = hasYearSpecificPropertyCounts
    ? assessment.historicalCleanupPeriods.reduce(
        (total, period) => total + countValue(period.purchasedOrSoldPropertiesCount ?? 0),
        0,
      )
    : countValue(assessment.cleanupPurchasedOrSoldPropertiesCount);
  const hasComplexOperations = hasComplexRealEstateOperations(assessment);
  const multipleOperations = knownRealEstateOperationCount(assessment) >= 2;
  const transactionBandMonthly = assessment.transactionBand
    ? pkg.pricing.transactionBandMonthly[assessment.transactionBand]
    : 0;
  const baseMonthly =
    pkg.monthlyPrice +
    propertyCount * pkg.pricing.recurringPerProperty +
    entityCount * pkg.pricing.recurringPerEntity +
    pkg.pricing.recurringComplexity[complexityLevel] +
    transactionBandMonthly +
    (countValue(assessment.employeesCount) + countValue(assessment.contractorsCount)) *
      pkg.pricing.staffingPerPerson +
    amountForThreshold(reconciliationCount, pkg.pricing.reconciliationThresholds) +
    amountForThreshold(knownPaymentPlatformCount(assessment), pkg.pricing.platformThresholds) +
    amountForThreshold(countValue(assessment.zeroBalancePlatformCount), pkg.pricing.passThroughThresholds) +
    (assessment.bookSetType === "mixed-books"
      ? pkg.pricing.mixedBooksMonthly
      : assessment.bookSetType === "other-business"
        ? pkg.pricing.nonReBusinessMonthly
        : 0) +
    (hasComplexOperations ? pkg.pricing.complexOperationsMonthly : 0) +
    (!hasComplexOperations && multipleOperations ? pkg.pricing.multiOperationMonthly : 0);
  const monthly = roundUpToNearestIncrement(baseMonthly * assessment.discretionaryMultiplier);

  const catchUpBase = monthly * cleanupMonths;
  const assessmentOneTimeAdjustments =
    propertyCount * pkg.pricing.backlogPerProperty +
    entityCount * pkg.pricing.backlogPerEntity +
    cleanupPurchasedOrSoldPropertiesCount * CLEANUP_PURCHASED_OR_SOLD_PROPERTY_COST +
    Math.round(catchUpBase * pkg.pricing.catchUpComplexityMultiplier[complexityLevel]);
  const totalOneTimeBeforeManual = roundUpToNearestIncrement(
    catchUpBase + assessmentOneTimeAdjustments,
  );

  return {
    packageId: pkg.id,
    complexityLevel,
    monthly,
    catchUpBase,
    assessmentOneTimeAdjustments,
    totalOneTimeBeforeManual,
    totalOneTime: roundUpToNearestIncrement(totalOneTimeBeforeManual + manualAdjustmentAmount),
  };
}

function buildRecommendation(assessment: AssessmentState): RecommendationSummary {
  const cleanupMonths = hasCatchUpPricingInputs(assessment)
    ? calculateInclusiveMonths(assessment.cleanupStartMonth, assessment.cleanupEndMonth)
    : 0;
  const isMixedBooks = assessment.bookSetType === "mixed-books";
  const isOtherBusiness = assessment.bookSetType === "other-business";
  const opsCount = knownRealEstateOperationCount(assessment);
  const hasComplexOperations = hasComplexRealEstateOperations(assessment);
  const txScore = transactionBandScore(assessment.transactionBand);
  const headcount = countValue(assessment.employeesCount) + countValue(assessment.contractorsCount);
  const reconciliationCount = reconciliationAccountCount(assessment);
  const paymentPlatformComplexity = paymentPlatformComplexityCount(assessment);

  let score = 0;
  score += txScore;
  if (countValue(assessment.numberOfProperties) >= 10) score += 2;
  else if (countValue(assessment.numberOfProperties) >= 4) score += 1;
  if (countValue(assessment.numberOfEntities) >= 3) score += 2;
  else if (countValue(assessment.numberOfEntities) >= 2) score += 1;
  if (headcount >= 8) score += 2;
  else if (headcount >= 3) score += 1;
  if (reconciliationCount >= 12) score += 2;
  else if (reconciliationCount >= 6) score += 1;
  if (paymentPlatformComplexity >= 6) score += 2;
  else if (paymentPlatformComplexity >= 2) score += 1;
  if (hasComplexOperations) score += 2;
  else if (opsCount >= 2) score += 1;
  if (isMixedBooks) score += 2;
  if (isOtherBusiness) score += 1;

  let packageId: PackageId = "improve";
  if (score <= 2) packageId = "maintain";
  if (score >= 7) packageId = "grow";

  const servicePath =
    cleanupMonths > 0
      ? "Monthly bookkeeping plus historical catch-up"
      : "Monthly bookkeeping only";

  const confidence =
    isOtherBusiness || isMixedBooks
      ? "Needs human review"
      : packageId === "grow"
        ? "High-complexity fit"
        : packageId === "maintain"
          ? "Simpler monthly fit"
          : "Default recommendation";

  const rationale: string[] = [];
  if (assessment.bookSetType === "real-estate-only") {
    rationale.push("The books appear to be primarily real-estate books, so the REI package path is a fit.");
  }
  if (isMixedBooks) {
    rationale.push("The books are mixed, which usually pushes us toward a more guided package and a custom scope review.");
  }
  if (txScore >= 2) {
    rationale.push(`The transaction profile (${assessment.transactionBand}) suggests a heavier monthly workload.`);
  }
  if (countValue(assessment.numberOfEntities) > 1) {
    rationale.push(`${countValue(assessment.numberOfEntities)} entities increase coordination and reporting complexity.`);
  }
  if (countValue(assessment.numberOfProperties) > 0) {
    rationale.push(`${countValue(assessment.numberOfProperties)} properties point toward a portfolio-style bookkeeping scope.`);
  }
  if (reconciliationCount > 0) {
    rationale.push(
      `${reconciliationCount} balance-sheet accounts suggest a heavier reconciliation process each month.`,
    );
  }
  const knownPlatformCount = knownPaymentPlatformCount(assessment);
  if (knownPlatformCount > 0) {
    rationale.push(
      `${knownPlatformCount} payment platform or clearing-channel flows add transfer tracing beyond the bank feeds.`,
    );
  }
  if (hasComplexOperations) {
    rationale.push("The mix of real-estate operations adds complexity beyond a basic monthly close.");
  }
  if (cleanupMonths > 0) {
    rationale.push(`A ${cleanupMonths}-month cleanup window means catch-up work should be framed separately from the monthly tier.`);
  }
  if (rationale.length === 0) {
    rationale.push("The current facts point to a standard monthly bookkeeping recommendation.");
  }

  const watchouts: string[] = [];
  if (isOtherBusiness) {
    watchouts.push("This does not look like a pure real-estate bookkeeping engagement, so the proposal will likely need a custom path.");
  }
  if (isMixedBooks) {
    watchouts.push("Mixed books should be reviewed carefully before assuming a standard REI package fit.");
  }
  if (assessment.taxElection === "unknown") {
    watchouts.push("Tax election is still unknown, so entity complexity may be understated.");
  }
  if (countValue(assessment.employeesCount) > 0 || countValue(assessment.contractorsCount) > 0) {
    watchouts.push("Payroll and contractor activity should be confirmed before final pricing is approved.");
  }
  if (countValue(assessment.zeroBalancePlatformCount) > 0) {
    watchouts.push(
      "Zero-balance pass-through channels still require disbursement tracing even when no platform balance remains on hand.",
    );
  }
  if (
    countValue(assessment.loansCount) > 0 ||
    countValue(assessment.vehicleNotesCount) > 0 ||
    countValue(assessment.linesOfCreditCount) > 0
  ) {
    watchouts.push(
      "Debt-related accounts should be reconciled carefully so liability balances and supporting schedules stay aligned.",
    );
  }

  return { servicePath, packageId, confidence, rationale, watchouts };
}

export function getProposalPricingSnapshotData(assessment: AssessmentState) {
  const cleanupMonths = hasCatchUpPricingInputs(assessment)
    ? calculateInclusiveMonths(assessment.cleanupStartMonth, assessment.cleanupEndMonth)
    : 0;
  const manualAdjustmentsTotal = 0;
  const recommendation = buildRecommendation(assessment);
  const packagePricing = Object.fromEntries(
    PACKAGES.map((pkg) => [
      pkg.id,
      buildPackagePricing(pkg, assessment, cleanupMonths, manualAdjustmentsTotal),
    ]),
  ) as Record<PackageId, PackagePricingSummary>;
  const maintainPricing = packagePricing.maintain;

  packagePricing.grow = {
    ...packagePricing.grow,
    monthly: roundUpToNearestIncrement(
      maintainPricing.monthly * GROW_PRICE_MULTIPLIER_FROM_MAINTAIN,
    ),
    catchUpBase: roundUpToNearestIncrement(
      maintainPricing.catchUpBase * GROW_PRICE_MULTIPLIER_FROM_MAINTAIN,
    ),
    assessmentOneTimeAdjustments: roundUpToNearestIncrement(
      maintainPricing.assessmentOneTimeAdjustments * GROW_PRICE_MULTIPLIER_FROM_MAINTAIN,
    ),
    totalOneTimeBeforeManual: roundUpToNearestIncrement(
      maintainPricing.totalOneTimeBeforeManual * GROW_PRICE_MULTIPLIER_FROM_MAINTAIN,
    ),
    totalOneTime: roundUpToNearestIncrement(
      maintainPricing.totalOneTime * GROW_PRICE_MULTIPLIER_FROM_MAINTAIN,
    ),
  };

  return {
    cleanupMonths,
    recommendation,
    packagePricing,
    hasCatchUpPricing: hasCatchUpPricingInputs(assessment),
  };
}

export function getProposalPricingSnapshotItems(assessment: AssessmentState) {
  const { packagePricing, recommendation } = getProposalPricingSnapshotData(assessment);
  const hasMonthlyPricing = hasMonthlyPricingInputs(assessment);

  return PACKAGES.map((pkg) => ({
    id: pkg.id,
    name: pkg.name,
    monthlyLabel: hasMonthlyPricing
      ? formatCurrency(packagePricing[pkg.id].monthly, "/mo")
      : "- /mo",
    isRecommended: hasMonthlyPricing && recommendation.packageId === pkg.id,
  }));
}

export function getProposalPricingSnapshotCleanupCard(assessment: AssessmentState) {
  const { cleanupMonths, packagePricing, hasCatchUpPricing } =
    getProposalPricingSnapshotData(assessment);

  if (!hasCatchUpPricing) {
    return undefined;
  }

  const maintainPricing = packagePricing.maintain;
  const baseRow =
    cleanupMonths > 0
      ? `${formatCurrency(maintainPricing.monthly)} x ${cleanupMonths} ${
          cleanupMonths === 1 ? "month" : "months"
        } = ${formatCurrency(maintainPricing.catchUpBase)}`
      : undefined;

  return {
    amountLabel: formatCurrency(maintainPricing.totalOneTimeBeforeManual),
    baseRow,
    addOnsRow: `${formatCurrency(maintainPricing.assessmentOneTimeAdjustments)} required adjustments`,
  };
}

export function getProposalPreviewPackages(assessment: AssessmentState) {
  const { packagePricing, recommendation, hasCatchUpPricing } = getProposalPricingSnapshotData(assessment);
  const hasMonthly = hasMonthlyPricingInputs(assessment);

  return PACKAGES.map((pkg) => {
    const pricing = packagePricing[pkg.id];
    return {
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      clientFit: pkg.clientFit,
      includedServices: pkg.includedServices,
      monthlyLabel: hasMonthly ? formatCurrency(pricing.monthly, "/mo") : "— /mo",
      isRecommended: hasMonthly && recommendation.packageId === pkg.id,
      oneTimeLabel: hasCatchUpPricing && pricing.totalOneTime > 0 ? formatCurrency(pricing.totalOneTime) : null,
    };
  });
}

export default function ProposalCreationWorkspaceDemo({
  step = "scale",
  catalogServices = [],
}: {
  step?: ProposalAssessmentStep;
  catalogServices?: IncludedCatalogService[];
}) {
  const {
    assessment,
    updateAssessment,
    togglePaymentPlatform,
    toggleContractorType,
    toggleCustomerInvoicingMethod,
    toggleBankUsed,
    togglePayrollPaymentMethod,
  } = useProposalAssessmentDemoState();
  const { brand } = useBrand();
  const [expandAllSignal, setExpandAllSignal] = useState<ProposalAppCollapsibleForceSignal>({
    value: false,
    token: 0,
  });
  const isScaleStep = step === "scale";
  const isComplexityStep = step === "pricing";
  const isIncludedStep = step === "included";
  const isCalculatorStep = step === "calculator";
  const nextStepHref =
    step === "scale"
        ? "/offers/pricing"
      : step === "pricing"
        ? "/offers/included"
        : step === "included"
          ? "/offers/calculator"
          : "/offers/add-ons";
  const previousStepHref =
    step === "scale"
        ? "/offers/new"
      : step === "pricing"
        ? "/offers/scale"
        : step === "included"
          ? "/offers/pricing"
          : "/offers/included";

  const showRealEstateFields =
    assessment.bookSetType === "real-estate-only" ||
    assessment.bookSetType === "mixed-books";
  const needsHistoricalCleanup = assessment.booksOverTwoMonthsBehind === true;
  function setHistoricalCleanupPeriods(periods: HistoricalCleanupPeriod[]) {
    const sortedStarts = periods
      .map((period) => `${period.year}-${String(period.startMonth).padStart(2, "0")}`)
      .sort();
    const sortedEnds = periods
      .map((period) => `${period.year}-${String(period.endMonth).padStart(2, "0")}`)
      .sort();

    updateAssessment("historicalCleanupPeriods", periods);
    updateAssessment("cleanupStartMonth", sortedStarts[0] ?? "");
    updateAssessment("cleanupEndMonth", sortedEnds.at(-1) ?? "");
  }

  function addHistoricalCleanupPeriod() {
    const earliestYear = Math.min(
      ...assessment.historicalCleanupPeriods.map((period) => period.year),
      CURRENT_YEAR + 1,
    );
    const year = earliestYear - 1;
    setHistoricalCleanupPeriods([
      ...assessment.historicalCleanupPeriods,
      { id: `cleanup-${year}-${Date.now()}`, year, startMonth: 1, endMonth: 12, platform: "qbo", purchasedOrSoldPropertiesCount: 0 },
    ]);
  }
  const selectedPayrollQboIntegrationStatus = PAYROLL_QBO_INTEGRATION_STATUS_OPTIONS.find(
    (option) => option.value === assessment.payrollQboIntegrationStatus,
  );
  const selectedContractorPayCadence = CONTRACTOR_PAY_CADENCE_OPTIONS.find(
    (option) => option.value === assessment.contractorPayCadence,
  );
  const { contactInfo } = useProposalContactInfoDemoState();
  const resolvedAdminAssistantContact = resolveContactSourceValues(
    assessment.adminAssistantContactSource,
    assessment.adminAssistantContactOwnerId,
    {
      firstName: assessment.adminAssistantFirstName,
      lastName: assessment.adminAssistantLastName,
      email: assessment.adminAssistantEmail,
      phone: assessment.adminAssistantPhone,
    },
    contactInfo,
  );
  const resolvedPayrollContact = resolveContactSourceValues(
    assessment.payrollContactSource,
    assessment.payrollContactOwnerId,
    {
      firstName: assessment.payrollContactFirstName,
      lastName: assessment.payrollContactLastName,
      email: assessment.payrollContactEmail,
      phone: assessment.payrollContactPhone,
    },
    contactInfo,
  );
  const { packagePricing } = getProposalPricingSnapshotData(assessment);
  const maintainPricing = packagePricing.maintain;
  const { baseItems: maintainBaseItems, adjustmentItems: maintainAdjustmentItems } =
    getMonthlyRateBreakdown(MAINTAIN_PACKAGE, assessment, maintainPricing.complexityLevel);
  const maintainBaseMonthlyTotal = maintainBaseItems.reduce((sum, item) => sum + item.amount, 0);

  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto w-full max-w-[1720px] px-5 py-6 lg:px-8">
        <div>
          <ProposalAppDemoHeader
            currentStep={
              isScaleStep ? "scale" : isComplexityStep ? "complexity" : "pricing"
            }
            previousHref={previousStepHref}
            nextHref={nextStepHref}
          />

          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_440px] 2xl:grid-cols-[minmax(0,1.55fr)_470px]">
            <div className="space-y-3">
              <div className="flex justify-start px-1">
                <ProposalAppExpandAllControl
                  onExpandAll={() => setExpandAllSignal({ value: true, token: Date.now() })}
                  onCollapseAll={() => setExpandAllSignal({ value: false, token: Date.now() })}
                />
              </div>
              <section
                className={`proposal-builder-card rounded-[1.5rem] ${
                  isIncludedStep
                    ? "overflow-visible"
                    : "overflow-hidden border border-slate-300 shadow-sm"
                }`}
              >
                {isScaleStep ? (
                  <ProposalAppCollapsibleSection
                    title="Portfolio Scale"
                    forceOpen={expandAllSignal}
                  >
                    {showRealEstateFields ? (
                      <div className="max-w-[280px]">
                        <FieldLabel label="Number of Properties">
                          <input
                            type="number"
                            min={0}
                            value={assessment.numberOfProperties}
                            onChange={(event) => updateAssessment("numberOfProperties", parseCountInput(event.target.value))}
                            className={INPUT_CLASS_NAME}
                          />
                        </FieldLabel>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">Property count does not apply to the selected book-set type.</p>
                    )}
                  </ProposalAppCollapsibleSection>
                ) : null}

                {isComplexityStep ? (
                  <ProposalAppCollapsibleSection
                    title="Connected Accounts"
                    forceOpen={expandAllSignal}
                  >
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <FieldLabel label="Bank Accounts">
                        <input
                          type="number"
                          min={0}
                          value={assessment.bankAccountsCount}
                          onChange={(event) =>
                            updateAssessment(
                              "bankAccountsCount",
                              parseCountInput(event.target.value),
                            )
                          }
                          className={INPUT_CLASS_NAME}
                        />
                      </FieldLabel>
                      <FieldLabel label="Credit Cards">
                        <input
                          type="number"
                          min={0}
                          value={assessment.creditCardsCount}
                          onChange={(event) =>
                            updateAssessment(
                              "creditCardsCount",
                              parseCountInput(event.target.value),
                            )
                          }
                          className={INPUT_CLASS_NAME}
                        />
                      </FieldLabel>
                      <FieldLabel label="Lines of Credit">
                        <input
                          type="number"
                          min={0}
                          value={assessment.linesOfCreditCount}
                          onChange={(event) =>
                            updateAssessment(
                              "linesOfCreditCount",
                              parseCountInput(event.target.value),
                            )
                          }
                          className={INPUT_CLASS_NAME}
                        />
                      </FieldLabel>
                    </div>
                  </ProposalAppCollapsibleSection>
                ) : null}

                {isComplexityStep ? (
                  <ProposalAppCollapsibleSection
                    title="Unconnected Accounts That Require Reconciliation"
                    forceOpen={expandAllSignal}
                  >
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <FieldLabel label="Bank Accounts">
                        <input
                          type="number"
                          min={0}
                          value={assessment.unconnectedBankAccountsCount}
                          onChange={(event) =>
                            updateAssessment(
                              "unconnectedBankAccountsCount",
                              parseCountInput(event.target.value),
                            )
                          }
                          className={INPUT_CLASS_NAME}
                        />
                      </FieldLabel>
                      <FieldLabel label="Credit Cards">
                        <input
                          type="number"
                          min={0}
                          value={assessment.unconnectedCreditCardsCount}
                          onChange={(event) =>
                            updateAssessment(
                              "unconnectedCreditCardsCount",
                              parseCountInput(event.target.value),
                            )
                          }
                          className={INPUT_CLASS_NAME}
                        />
                      </FieldLabel>
                      <FieldLabel label="Lines of Credit">
                        <input
                          type="number"
                          min={0}
                          value={assessment.unconnectedLinesOfCreditCount}
                          onChange={(event) =>
                            updateAssessment(
                              "unconnectedLinesOfCreditCount",
                              parseCountInput(event.target.value),
                            )
                          }
                          className={INPUT_CLASS_NAME}
                        />
                      </FieldLabel>
                    </div>
                  </ProposalAppCollapsibleSection>
                ) : null}

                {isComplexityStep ? (
                  <ProposalAppCollapsibleSection
                    title="Payment Platforms / Clearing Channels"
                    forceOpen={expandAllSignal}
                  >
                    <FieldLabel label="Platforms in Use" className="mt-4">
                      <div className="flex flex-wrap gap-3">
                        {PAYMENT_PLATFORM_OPTIONS.map((platform) => {
                          const selected = assessment.paymentPlatforms.includes(platform.value);
                          return (
                            <button
                              key={platform.value}
                              type="button"
                              onClick={() => togglePaymentPlatform(platform.value)}
                              className={`proposal-builder-option rounded-full border px-4 py-2 text-sm font-semibold transition ${
                                selected
                                  ? "border-brandnavy bg-brandnavy text-white"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                              }`}
                            >
                              {platform.label}
                            </button>
                          );
                        })}
                      </div>
                    </FieldLabel>

                    <div className="mt-4 max-w-[280px]">
                      <FieldLabel label="Pass Through Accounts">
                        <input
                          type="number"
                          min={0}
                          value={assessment.zeroBalancePlatformCount}
                          onChange={(event) =>
                            updateAssessment(
                              "zeroBalancePlatformCount",
                              parseCountInput(event.target.value),
                            )
                          }
                          className={INPUT_CLASS_NAME}
                        />
                      </FieldLabel>
                    </div>
                  </ProposalAppCollapsibleSection>
                ) : null}

                {isComplexityStep ? (
                  <ProposalAppCollapsibleSection
                    title="Additional Liabilities"
                    forceOpen={expandAllSignal}
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <FieldLabel label="Loans">
                        <input
                          type="number"
                          min={0}
                          value={assessment.loansCount}
                          onChange={(event) =>
                            updateAssessment("loansCount", parseCountInput(event.target.value))
                          }
                          className={INPUT_CLASS_NAME}
                        />
                      </FieldLabel>
                      <FieldLabel label="Vehicle / Equipment Notes">
                        <input
                          type="number"
                          min={0}
                          value={assessment.vehicleNotesCount}
                          onChange={(event) =>
                            updateAssessment(
                              "vehicleNotesCount",
                              parseCountInput(event.target.value),
                            )
                          }
                          className={INPUT_CLASS_NAME}
                        />
                      </FieldLabel>
                    </div>
                  </ProposalAppCollapsibleSection>
                ) : null}

                {isComplexityStep ? (
                  <ProposalAppCollapsibleSection
                    title="Payroll & Contractors"
                    forceOpen={expandAllSignal}
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="grid gap-2">
                        <span className={FIELD_LABEL_CLASS}>Number of W-2 Employees</span>
                        <input
                          type="number"
                          min={0}
                          value={assessment.employeesCount}
                          onChange={(event) =>
                            updateAssessment(
                              "employeesCount",
                              parseCountInput(event.target.value),
                            )
                          }
                          className={INPUT_CLASS_NAME}
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className={FIELD_LABEL_CLASS}>Number of Contractors</span>
                        <input
                          type="number"
                          min={0}
                          value={assessment.contractorsCount}
                          onChange={(event) =>
                            updateAssessment(
                              "contractorsCount",
                              parseCountInput(event.target.value),
                            )
                          }
                          className={INPUT_CLASS_NAME}
                        />
                      </label>
                      <FieldLabel label="Do They Run Payroll?">
                        <div className="flex h-[50px] items-center gap-6 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm">
                          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="radio"
                              name="runs-payroll"
                              checked={assessment.runsPayroll === true}
                              onChange={() => updateAssessment("runsPayroll", true)}
                              className="h-4 w-4 border-slate-300 text-brandnavy focus:ring-brandnavy"
                            />
                            Yes
                          </label>
                          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="radio"
                              name="runs-payroll"
                              checked={assessment.runsPayroll === false}
                              onChange={() => updateAssessment("runsPayroll", false)}
                              className="h-4 w-4 border-slate-300 text-brandnavy focus:ring-brandnavy"
                            />
                            No
                          </label>
                          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="radio"
                              name="runs-payroll"
                              checked={assessment.runsPayroll === null}
                              onChange={() => updateAssessment("runsPayroll", null)}
                              className="h-4 w-4 border-slate-300 text-brandnavy focus:ring-brandnavy"
                            />
                            Unknown
                          </label>
                        </div>
                      </FieldLabel>
                      {assessment.runsPayroll ? (
                        <>
                          <FieldLabel label="Payroll Provider">
                            <select
                              value={assessment.payrollProvider}
                              onChange={(event) =>
                                updateAssessment(
                                  "payrollProvider",
                                  event.target.value as PayrollProvider,
                                )
                              }
                              className={INPUT_CLASS_NAME}
                            >
                              {PAYROLL_PROVIDER_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </FieldLabel>
                          <FieldLabel label="How Often Do You Pay People?">
                            <select
                              value={assessment.payCadence}
                              onChange={(event) =>
                                updateAssessment("payCadence", event.target.value as PayCadence)
                              }
                              className={INPUT_CLASS_NAME}
                            >
                              {PAY_CADENCE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </FieldLabel>
                          <FieldLabel label="Who Runs / Oversees Payroll?">
                            <select
                              value={assessment.payrollResponsibleParty}
                              onChange={(event) =>
                                updateAssessment(
                                  "payrollResponsibleParty",
                                  event.target.value as PayrollResponsibleParty,
                                )
                              }
                              className={INPUT_CLASS_NAME}
                            >
                              {PAYROLL_RESPONSIBLE_PARTY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </FieldLabel>
                          <FieldLabel label="Is Payroll Integrated With QBO?">
                            <select
                              value={assessment.payrollQboIntegrationStatus}
                              onChange={(event) =>
                                updateAssessment(
                                  "payrollQboIntegrationStatus",
                                  event.target.value as PayrollQboIntegrationStatus,
                                )
                              }
                              className={INPUT_CLASS_NAME}
                            >
                              {PAYROLL_QBO_INTEGRATION_STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </FieldLabel>
                        </>
                      ) : null}
                    </div>

                    {assessment.runsPayroll ? (
                      <>
                        {selectedPayrollQboIntegrationStatus?.description ? (
                          <p className="mt-2 text-sm text-slate-500">
                            {selectedPayrollQboIntegrationStatus.description}
                          </p>
                        ) : null}

                        <div className="mt-4">
                          <FieldLabel label="How Are Payments Made to Employees / Contractors?">
                            <div className="flex flex-wrap gap-3">
                              {PAYROLL_PAYMENT_METHOD_OPTIONS.map((method) => {
                                const selected = assessment.payrollPaymentMethods.includes(
                                  method.value,
                                );
                                return (
                                  <button
                                    key={method.value}
                                    type="button"
                                    onClick={() => togglePayrollPaymentMethod(method.value)}
                                  className={`proposal-builder-option rounded-full border px-4 py-2 text-sm font-semibold transition ${
                                      selected
                                        ? "border-brandnavy bg-brandnavy text-white"
                                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                                    }`}
                                  >
                                    {method.label}
                                  </button>
                                );
                              })}
                            </div>
                          </FieldLabel>
                        </div>

                        <ContactSourcePicker
                          label="Payroll Contact — Get From"
                          source={assessment.payrollContactSource}
                          ownerId={assessment.payrollContactOwnerId}
                          custom={{
                            firstName: assessment.payrollContactFirstName,
                            lastName: assessment.payrollContactLastName,
                            email: assessment.payrollContactEmail,
                            phone: assessment.payrollContactPhone,
                          }}
                          resolved={resolvedPayrollContact}
                          owners={contactInfo.owners}
                          onSourceChange={(value) =>
                            updateAssessment("payrollContactSource", value)
                          }
                          onOwnerIdChange={(value) =>
                            updateAssessment("payrollContactOwnerId", value)
                          }
                          onFirstNameChange={(value) =>
                            updateAssessment("payrollContactFirstName", value)
                          }
                          onLastNameChange={(value) =>
                            updateAssessment("payrollContactLastName", value)
                          }
                          onEmailChange={(value) => updateAssessment("payrollContactEmail", value)}
                          onPhoneChange={(value) => updateAssessment("payrollContactPhone", value)}
                        />
                      </>
                    ) : null}

                    <div className="mt-4">
                      <FieldLabel label="Recurring Contractor Types">
                        <div className="flex flex-wrap gap-3">
                          {CONTRACTOR_TYPE_OPTIONS.map((contractorType) => {
                            const selected = assessment.recurringContractorTypes.includes(
                              contractorType.value,
                            );
                            return (
                              <button
                                key={contractorType.value}
                                type="button"
                                onClick={() => toggleContractorType(contractorType.value)}
                                className={`proposal-builder-option rounded-full border px-4 py-2 text-sm font-semibold transition ${
                                  selected
                                    ? "border-brandnavy bg-brandnavy text-white"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                                }`}
                              >
                                {contractorType.label}
                              </button>
                            );
                          })}
                        </div>
                      </FieldLabel>
                    </div>

                    <div className="mt-4 max-w-[420px]">
                      <FieldLabel label="How Are Contractors Typically Paid?">
                        <select
                          value={assessment.contractorPayCadence}
                          onChange={(event) =>
                            updateAssessment(
                              "contractorPayCadence",
                              event.target.value as ContractorPayCadence,
                            )
                          }
                          className={INPUT_CLASS_NAME}
                        >
                          {CONTRACTOR_PAY_CADENCE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </FieldLabel>
                      {selectedContractorPayCadence?.description ? (
                        <p className="mt-2 text-sm text-slate-500">
                          {selectedContractorPayCadence.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-4 max-w-[420px]">
                      <FieldLabel label="Do They Have an Admin Assistant Who Provides Requested Documentation?">
                        <div className="flex h-[50px] items-center gap-6 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm">
                          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="radio"
                              name="has-admin-assistant"
                              checked={assessment.hasAdminAssistant === true}
                              onChange={() => updateAssessment("hasAdminAssistant", true)}
                              className="h-4 w-4 border-slate-300 text-brandnavy focus:ring-brandnavy"
                            />
                            Yes
                          </label>
                          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="radio"
                              name="has-admin-assistant"
                              checked={assessment.hasAdminAssistant === false}
                              onChange={() => updateAssessment("hasAdminAssistant", false)}
                              className="h-4 w-4 border-slate-300 text-brandnavy focus:ring-brandnavy"
                            />
                            No
                          </label>
                          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="radio"
                              name="has-admin-assistant"
                              checked={assessment.hasAdminAssistant === null}
                              onChange={() => updateAssessment("hasAdminAssistant", null)}
                              className="h-4 w-4 border-slate-300 text-brandnavy focus:ring-brandnavy"
                            />
                            Unknown
                          </label>
                        </div>
                      </FieldLabel>
                    </div>

                    {assessment.hasAdminAssistant ? (
                      <ContactSourcePicker
                        label="Admin Assistant Contact — Get From"
                        source={assessment.adminAssistantContactSource}
                        ownerId={assessment.adminAssistantContactOwnerId}
                        custom={{
                          firstName: assessment.adminAssistantFirstName,
                          lastName: assessment.adminAssistantLastName,
                          email: assessment.adminAssistantEmail,
                          phone: assessment.adminAssistantPhone,
                        }}
                        resolved={resolvedAdminAssistantContact}
                        owners={contactInfo.owners}
                        onSourceChange={(value) =>
                          updateAssessment("adminAssistantContactSource", value)
                        }
                        onOwnerIdChange={(value) =>
                          updateAssessment("adminAssistantContactOwnerId", value)
                        }
                        onFirstNameChange={(value) =>
                          updateAssessment("adminAssistantFirstName", value)
                        }
                        onLastNameChange={(value) =>
                          updateAssessment("adminAssistantLastName", value)
                        }
                        onEmailChange={(value) => updateAssessment("adminAssistantEmail", value)}
                        onPhoneChange={(value) => updateAssessment("adminAssistantPhone", value)}
                      />
                    ) : null}
                  </ProposalAppCollapsibleSection>
                ) : null}

                {isComplexityStep ? (
                  <ProposalAppCollapsibleSection
                    title="Customer Invoicing & Banking"
                    forceOpen={expandAllSignal}
                  >
                    <FieldLabel label="How Do They Invoice Their Customers?">
                      <div className="flex flex-wrap gap-3">
                        {CUSTOMER_INVOICING_METHOD_OPTIONS.map((method) => {
                          const selected = assessment.customerInvoicingMethods.includes(
                            method.value,
                          );
                          return (
                            <button
                              key={method.value}
                              type="button"
                              onClick={() => toggleCustomerInvoicingMethod(method.value)}
                            className={`proposal-builder-option rounded-full border px-4 py-2 text-sm font-semibold transition ${
                                selected
                                  ? "border-brandnavy bg-brandnavy text-white"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                              }`}
                            >
                              {method.label}
                            </button>
                          );
                        })}
                      </div>
                    </FieldLabel>

                    <div className="mt-4 max-w-[420px]">
                      <FieldLabel label="Do They Accept Tips That Must Be Passed on to Contractors?">
                        <div className="flex h-[50px] items-center gap-6 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm">
                          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="radio"
                              name="accepts-tips-for-contractors"
                              checked={assessment.acceptsTipsForContractors === true}
                              onChange={() => updateAssessment("acceptsTipsForContractors", true)}
                              className="h-4 w-4 border-slate-300 text-brandnavy focus:ring-brandnavy"
                            />
                            Yes
                          </label>
                          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="radio"
                              name="accepts-tips-for-contractors"
                              checked={assessment.acceptsTipsForContractors === false}
                              onChange={() => updateAssessment("acceptsTipsForContractors", false)}
                              className="h-4 w-4 border-slate-300 text-brandnavy focus:ring-brandnavy"
                            />
                            No
                          </label>
                          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="radio"
                              name="accepts-tips-for-contractors"
                              checked={assessment.acceptsTipsForContractors === null}
                              onChange={() => updateAssessment("acceptsTipsForContractors", null)}
                              className="h-4 w-4 border-slate-300 text-brandnavy focus:ring-brandnavy"
                            />
                            Unknown
                          </label>
                        </div>
                      </FieldLabel>
                    </div>

                    {assessment.acceptsTipsForContractors ? (
                      <div className="mt-4 max-w-[420px]">
                        <FieldLabel label="Do They Have a Tips Liability Account Set Up? (They Should)">
                          <div className="flex h-[50px] items-center gap-6 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm">
                            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                              <input
                                type="radio"
                                name="has-tips-liability-account"
                                checked={assessment.hasTipsLiabilityAccount === true}
                                onChange={() => updateAssessment("hasTipsLiabilityAccount", true)}
                                className="h-4 w-4 border-slate-300 text-brandnavy focus:ring-brandnavy"
                              />
                              Yes
                            </label>
                            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                              <input
                                type="radio"
                                name="has-tips-liability-account"
                                checked={assessment.hasTipsLiabilityAccount === false}
                                onChange={() => updateAssessment("hasTipsLiabilityAccount", false)}
                                className="h-4 w-4 border-slate-300 text-brandnavy focus:ring-brandnavy"
                              />
                              No
                            </label>
                            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                              <input
                                type="radio"
                                name="has-tips-liability-account"
                                checked={assessment.hasTipsLiabilityAccount === null}
                                onChange={() => updateAssessment("hasTipsLiabilityAccount", null)}
                                className="h-4 w-4 border-slate-300 text-brandnavy focus:ring-brandnavy"
                              />
                              Unknown
                            </label>
                          </div>
                        </FieldLabel>
                        {assessment.hasTipsLiabilityAccount === false ? (
                          <p className="mt-2 text-sm text-slate-500">
                            Without a tips liability account, tips collected on behalf of
                            contractors are hard to track separately from revenue — this should be
                            set up as part of the engagement.
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-4">
                      <FieldLabel label="Banks Used">
                        <div className="flex flex-wrap gap-3">
                          {BANK_OPTIONS.map((bank) => {
                            const selected = assessment.banksUsed.includes(bank.value);
                            return (
                              <button
                                key={bank.value}
                                type="button"
                                onClick={() => toggleBankUsed(bank.value)}
                                className={`proposal-builder-option rounded-full border px-4 py-2 text-sm font-semibold transition ${
                                  selected
                                    ? "border-brandnavy bg-brandnavy text-white"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                                }`}
                              >
                                {bank.label}
                              </button>
                            );
                          })}
                        </div>
                      </FieldLabel>
                    </div>

                    <div className="mt-4 max-w-[420px]">
                      <FieldLabel label="Do Their Banks Allow Delegate Access?">
                        <div className="flex h-[50px] items-center gap-6 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm">
                          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="radio"
                              name="banks-allow-delegate-access"
                              checked={assessment.banksAllowDelegateAccess === true}
                              onChange={() => updateAssessment("banksAllowDelegateAccess", true)}
                              className="h-4 w-4 border-slate-300 text-brandnavy focus:ring-brandnavy"
                            />
                            Yes
                          </label>
                          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="radio"
                              name="banks-allow-delegate-access"
                              checked={assessment.banksAllowDelegateAccess === false}
                              onChange={() => updateAssessment("banksAllowDelegateAccess", false)}
                              className="h-4 w-4 border-slate-300 text-brandnavy focus:ring-brandnavy"
                            />
                            No
                          </label>
                          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="radio"
                              name="banks-allow-delegate-access"
                              checked={assessment.banksAllowDelegateAccess === null}
                              onChange={() => updateAssessment("banksAllowDelegateAccess", null)}
                              className="h-4 w-4 border-slate-300 text-brandnavy focus:ring-brandnavy"
                            />
                            Unknown
                          </label>
                        </div>
                      </FieldLabel>
                    </div>
                  </ProposalAppCollapsibleSection>
                ) : null}

                {isScaleStep ? (
                  <ProposalAppCollapsibleSection
                    title="Monthly Activity"
                    forceOpen={expandAllSignal}
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <FieldLabel
                        label={
                          <span className="inline-flex items-center gap-1.5">
                            Average Monthly Transaction Volume
                            <span
                              tabIndex={0}
                              className="group relative inline-flex cursor-help text-slate-400 outline-none transition hover:text-slate-700 focus:text-slate-700"
                              aria-label="How to calculate average monthly transaction volume"
                            >
                              <CircleHelp className="h-3.5 w-3.5" />
                              <span
                                role="tooltip"
                                className="ui-tooltip pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-80 -translate-x-1/2 rounded-xl px-3 py-2.5 text-left text-xs font-normal normal-case leading-relaxed tracking-normal shadow-xl group-hover:block group-focus:block"
                              >
                                In QBO, open the General Ledger, set the date range, and export it as
                                a CSV. Open the CSV in a spreadsheet or upload it to an AI chatbot to
                                calculate the average monthly transaction count.
                              </span>
                            </span>
                          </span>
                        }
                      >
                        <select
                          value={assessment.transactionBand}
                          onChange={(event) =>
                            updateAssessment("transactionBand", event.target.value as TransactionBand)
                          }
                          className={INPUT_CLASS_NAME}
                        >
                          {TRANSACTION_BANDS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </FieldLabel>

                      <FieldLabel label="Books Over Two Months Behind?">
                        <div className="flex h-[50px] items-center gap-6 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm">
                          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="radio"
                              name="books-over-two-months-behind"
                              checked={assessment.booksOverTwoMonthsBehind === true}
                              onChange={() => updateAssessment("booksOverTwoMonthsBehind", true)}
                              className="h-4 w-4 border-slate-300 text-brandnavy focus:ring-brandnavy"
                            />
                            Yes
                          </label>
                          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="radio"
                              name="books-over-two-months-behind"
                              checked={assessment.booksOverTwoMonthsBehind === false}
                              onChange={() => updateAssessment("booksOverTwoMonthsBehind", false)}
                              className="h-4 w-4 border-slate-300 text-brandnavy focus:ring-brandnavy"
                            />
                            No
                          </label>
                          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="radio"
                              name="books-over-two-months-behind"
                              checked={assessment.booksOverTwoMonthsBehind === null}
                              onChange={() => updateAssessment("booksOverTwoMonthsBehind", null)}
                              className="h-4 w-4 border-slate-300 text-brandnavy focus:ring-brandnavy"
                            />
                            Unknown
                          </label>
                        </div>
                      </FieldLabel>
                    </div>
                  </ProposalAppCollapsibleSection>
                ) : null}

                {isScaleStep && needsHistoricalCleanup ? (
                  <ProposalAppCollapsibleSection
                    title="Historical Cleanup"
                    forceOpen={expandAllSignal}
                  >
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <div className="space-y-2 md:col-span-2 xl:col-span-4">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className={FIELD_LABEL_CLASS}>Historical Cleanup Periods</p>
                                <p className="mt-1 text-xs text-slate-500">Every selected month includes reconciliation. Current-year cleanup ends with last month; prior years default to January–December.</p>
                              </div>
                              <button
                                type="button"
                                onClick={addHistoricalCleanupPeriod}
                                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brandnavy hover:underline"
                              >
                                <Plus className="h-4 w-4" /> Add Year
                              </button>
                            </div>
                            {assessment.historicalCleanupPeriods.map((period) => (
                              <div key={period.id} className="grid gap-2 py-1 md:grid-cols-[110px_140px_1fr_1fr_150px_auto] md:items-end">
                                <FieldLabel label="Year">
                                  <input
                                    type="number"
                                    min={2000}
                                    max={2100}
                                    value={period.year}
                                    onChange={(event) => {
                                      const year = Number(event.target.value) || CURRENT_YEAR;
                                      setHistoricalCleanupPeriods(assessment.historicalCleanupPeriods.map((item) => item.id === period.id ? {
                                        ...item,
                                        year,
                                        endMonth: year === CURRENT_YEAR
                                          ? Math.min(item.endMonth, LAST_COMPLETED_MONTH)
                                          : item.endMonth,
                                      } : item));
                                    }}
                                    className={INPUT_CLASS_NAME}
                                  />
                                </FieldLabel>
                                <FieldLabel label="Platform">
                                  <select
                                    value={period.platform ?? "qbo"}
                                    onChange={(event) => {
                                      const platform = event.target.value as BookkeepingPlatform;
                                      setHistoricalCleanupPeriods(assessment.historicalCleanupPeriods.map((item) => item.id === period.id ? { ...item, platform } : item));
                                    }}
                                    className={INPUT_CLASS_NAME}
                                  >
                                    <option value="qbo">QuickBooks Online</option>
                                    <option value="stessa">Stessa</option>
                                  </select>
                                </FieldLabel>
                                <FieldLabel label="Starting Month">
                                  <select
                                    value={period.startMonth}
                                    onChange={(event) => {
                                      const startMonth = Number(event.target.value);
                                      setHistoricalCleanupPeriods(assessment.historicalCleanupPeriods.map((item) => item.id === period.id ? { ...item, startMonth, endMonth: Math.max(item.endMonth, startMonth) } : item));
                                    }}
                                    className={INPUT_CLASS_NAME}
                                  >
                                    {MONTH_OPTIONS.map((month, index) => (
                                      <option
                                        key={month}
                                        value={index + 1}
                                        disabled={period.year === CURRENT_YEAR && index + 1 > LAST_COMPLETED_MONTH}
                                      >
                                        {month}
                                      </option>
                                    ))}
                                  </select>
                                </FieldLabel>
                                <FieldLabel label="Ending Month">
                                  <select
                                    value={period.endMonth}
                                    onChange={(event) => {
                                      const endMonth = Number(event.target.value);
                                      setHistoricalCleanupPeriods(assessment.historicalCleanupPeriods.map((item) => item.id === period.id ? { ...item, endMonth, startMonth: Math.min(item.startMonth, endMonth) } : item));
                                    }}
                                    className={INPUT_CLASS_NAME}
                                  >
                                    {MONTH_OPTIONS.map((month, index) => (
                                      <option
                                        key={month}
                                        value={index + 1}
                                        disabled={period.year === CURRENT_YEAR && index + 1 > LAST_COMPLETED_MONTH}
                                      >
                                        {month}
                                      </option>
                                    ))}
                                  </select>
                                </FieldLabel>
                                <FieldLabel label="Properties Bought / Sold">
                                  <input
                                    type="number"
                                    min={0}
                                    value={period.purchasedOrSoldPropertiesCount ?? ""}
                                    onChange={(event) => {
                                      const purchasedOrSoldPropertiesCount = parseCountInput(event.target.value);
                                      setHistoricalCleanupPeriods(assessment.historicalCleanupPeriods.map((item) => item.id === period.id ? { ...item, purchasedOrSoldPropertiesCount } : item));
                                    }}
                                    className={INPUT_CLASS_NAME}
                                  />
                                </FieldLabel>
                                <button
                                  type="button"
                                  disabled={assessment.historicalCleanupPeriods.length === 1}
                                  onClick={() => setHistoricalCleanupPeriods(assessment.historicalCleanupPeriods.filter((item) => item.id !== period.id))}
                                  aria-label={`Remove ${period.year} cleanup period`}
                                  className="grid h-10 w-10 place-items-center text-slate-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <FieldLabel label="Ongoing Bookkeeping Platform">
                            <select
                              value={assessment.ongoingBookkeepingPlatform}
                              onChange={(event) => updateAssessment("ongoingBookkeepingPlatform", event.target.value as BookkeepingPlatform)}
                              className={INPUT_CLASS_NAME}
                            >
                              <option value="qbo">QuickBooks Online</option>
                              <option value="stessa">Stessa</option>
                            </select>
                          </FieldLabel>
                          <FieldLabel label="Platform Change">
                            <label className="flex h-[50px] items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm">
                              <input
                                type="checkbox"
                                checked={assessment.platformMigrationEnabled}
                                onChange={(event) => updateAssessment("platformMigrationEnabled", event.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-brandnavy focus:ring-brandnavy"
                              />
                              Move books to a new platform
                            </label>
                          </FieldLabel>
                          {assessment.platformMigrationEnabled ? (
                            <FieldLabel label="Platform Change Date">
                              <input
                                type="month"
                                value={assessment.platformMigrationEffectiveMonth}
                                onChange={(event) => updateAssessment("platformMigrationEffectiveMonth", event.target.value)}
                                className={INPUT_CLASS_NAME}
                              />
                            </FieldLabel>
                          ) : null}
                    </div>
                  </ProposalAppCollapsibleSection>
                ) : null}

                {isIncludedStep ? (
                  <IncludedServicesBuilder
                    catalogServices={catalogServices}
                    forceOpen={expandAllSignal}
                    realEstateBookSet={
                      assessment.bookSetType === "real-estate-only" || assessment.bookSetType === "mixed-books"
                    }
                  />
                ) : null}

                {isCalculatorStep ? (
                  <>
                    <ProposalAppCollapsibleSection
                      title="Monthly Base (Maintain)"
                      forceOpen={expandAllSignal}
                      headerMeta={
                        <p className="text-base font-semibold tracking-tight text-slate-900">
                          {formatCurrency(maintainBaseMonthlyTotal, "/mo")}
                        </p>
                      }
                      bodyClassName=""
                    >
                      {renderPricingBreakdownRows(maintainBaseItems, "maintain-base")}
                    </ProposalAppCollapsibleSection>

                    <ProposalAppCollapsibleSection
                      title="Required Adjustments"
                      forceOpen={expandAllSignal}
                      headerMeta={
                        <p className="text-base font-semibold tracking-tight text-slate-900">
                          {formatCurrency(maintainPricing.monthly, "/mo")}
                        </p>
                      }
                      bodyClassName=""
                    >
                          {maintainAdjustmentItems.length > 0 ? (
                            renderPricingBreakdownRows(maintainAdjustmentItems, "maintain-adjustment")
                          ) : (
                            <p className="border-t border-slate-200 px-5 py-3 text-sm text-slate-500">
                              No adjustments applied.
                            </p>
                          )}
                          <div className="grid gap-4 border-t border-slate-200 px-5 py-4 md:grid-cols-[220px_minmax(0,1fr)]">
                            <FieldLabel label="Discretionary Multiplier">
                              <div className="relative">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.05"
                                  value={assessment.discretionaryMultiplier}
                                  onChange={(event) =>
                                    updateAssessment(
                                      "discretionaryMultiplier",
                                      parseMultiplierInput(event.target.value),
                                    )
                                  }
                                  className={`${INPUT_CLASS_NAME} pr-10`}
                                />
                                <span className="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-sm font-semibold text-slate-400">
                                  x
                                </span>
                              </div>
                            </FieldLabel>
                            {assessment.discretionaryMultiplier !== 1 ? (
                              <FieldLabel label="Why are we overriding the standard rate?">
                                <input
                                  value={assessment.discretionaryMultiplierNote}
                                  onChange={(event) =>
                                    updateAssessment(
                                      "discretionaryMultiplierNote",
                                      event.target.value,
                                    )
                                  }
                                  className={INPUT_CLASS_NAME}
                                />
                              </FieldLabel>
                            ) : (
                              <div />
                            )}
                          </div>
                          <div className="grid gap-4 border-t border-slate-200 px-5 py-4 md:grid-cols-[220px_minmax(0,1fr)]">
                            <FieldLabel label="Annual Savings">
                              <div className="relative">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={assessment.annualSavingsPercent}
                                  onChange={(event) =>
                                    updateAssessment(
                                      "annualSavingsPercent",
                                      parseAnnualSavingsPercentInput(event.target.value),
                                    )
                                  }
                                  className={`${INPUT_CLASS_NAME} pr-10`}
                                />
                                <span className="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-sm font-semibold text-slate-400">
                                  %
                                </span>
                              </div>
                            </FieldLabel>
                            <p className="self-end text-xs text-slate-500">
                              Discount applied to monthly recurring services when the client chooses a 12-month agreement. Default 20%.
                            </p>
                          </div>
                          <div className="border-t border-slate-200 px-5 py-4">
                            <FieldLabel label="Onboarding Fee Override">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                placeholder="Use standard calculated fee"
                                value={assessment.onboardingFeeOverride ?? ""}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  updateAssessment("onboardingFeeOverride", value === "" ? null : Math.max(0, Number(value) || 0));
                                }}
                                className={INPUT_CLASS_NAME}
                              />
                            </FieldLabel>
                            <p className="mt-2 text-xs text-slate-500">Leave blank for the calculated fee. If waived, this amount is shown with a strikethrough on the proposal.</p>
                            <label className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                              <input
                                type="checkbox"
                                checked={assessment.waiveOnboardingFee}
                                onChange={(event) => {
                                  const checked = event.target.checked;
                                  updateAssessment("waiveOnboardingFee", checked);
                                  if (checked && assessment.onboardingFeeOverride === null) {
                                    updateAssessment(
                                      "onboardingFeeOverride",
                                      getStandardOnboardingFee(getCleanupMonthCount(assessment)),
                                    );
                                  }
                                }}
                                className="h-4 w-4 rounded border-slate-300 text-brandnavy focus:ring-brandnavy"
                              />
                              <span><span className="block">Waive onboarding fee</span><span className="block text-xs font-normal text-slate-500">Keeps the amount above and strikes it through on the proposal.</span></span>
                            </label>
                          </div>
                    </ProposalAppCollapsibleSection>

                    <ProposalAppCollapsibleSection
                      title="Internal Assessment Notes"
                      forceOpen={expandAllSignal}
                      bodyClassName="px-4 pb-4"
                    >
                          <textarea
                            rows={2}
                            value={assessment.assessmentNotes}
                            onChange={(event) =>
                              updateAssessment("assessmentNotes", event.target.value)
                            }
                            className="min-h-[84px] w-full resize-none border-0 border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-none outline-none transition focus:border-brandnavy focus:outline-none focus:ring-0"
                          />
                    </ProposalAppCollapsibleSection>
                  </>
                ) : null}
              </section>

            </div>
            <PricingSnapshotSidebar
              items={getProposalPricingSnapshotItems(assessment)}
              cleanupCard={getProposalPricingSnapshotCleanupCard(assessment)}
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function FieldLabel({
  label,
  className,
  children,
}: {
  label: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={["grid gap-2", className].filter(Boolean).join(" ")}>
      <span className={FIELD_LABEL_CLASS}>{label}</span>
      {children}
    </label>
  );
}

function ContactSourcePicker({
  label,
  source,
  ownerId,
  custom,
  resolved,
  owners,
  onSourceChange,
  onOwnerIdChange,
  onFirstNameChange,
  onLastNameChange,
  onEmailChange,
  onPhoneChange,
}: {
  label: string;
  source: ContactSourceType;
  ownerId: string;
  custom: { firstName: string; lastName: string; email: string; phone: string };
  resolved: { firstName: string; lastName: string; email: string; phone: string };
  owners: OwnerContact[];
  onSourceChange: (value: ContactSourceType) => void;
  onOwnerIdChange: (value: string) => void;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
}) {
  const isCustom = source === "custom" || source === "";

  return (
    <div className="mt-4">
      <div className="max-w-[280px]">
        <FieldLabel label={label}>
          <select
            value={source}
            onChange={(event) => onSourceChange(event.target.value as ContactSourceType)}
            className={INPUT_CLASS_NAME}
          >
            {CONTACT_SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FieldLabel>
      </div>

      {source === "business-owner" ? (
        <div className="mt-3 max-w-[280px]">
          <FieldLabel label="Business Owner">
            <select
              value={ownerId}
              onChange={(event) => onOwnerIdChange(event.target.value)}
              className={INPUT_CLASS_NAME}
            >
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {formatPersonName(owner.firstName, owner.lastName) || "Unnamed owner"}
                </option>
              ))}
            </select>
          </FieldLabel>
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <FieldLabel label="First Name">
          <input
            value={isCustom ? custom.firstName : resolved.firstName}
            onChange={(event) => onFirstNameChange(event.target.value)}
            className={INPUT_CLASS_NAME}
            readOnly={!isCustom}
          />
        </FieldLabel>
        <FieldLabel label="Last Name">
          <input
            value={isCustom ? custom.lastName : resolved.lastName}
            onChange={(event) => onLastNameChange(event.target.value)}
            className={INPUT_CLASS_NAME}
            readOnly={!isCustom}
          />
        </FieldLabel>
        <FieldLabel label="Email">
          <input
            type="email"
            value={isCustom ? custom.email : resolved.email}
            onChange={(event) => onEmailChange(event.target.value)}
            className={INPUT_CLASS_NAME}
            readOnly={!isCustom}
          />
        </FieldLabel>
        <FieldLabel label="Phone">
          <input
            value={isCustom ? custom.phone : resolved.phone}
            onChange={(event) => onPhoneChange(event.target.value)}
            className={INPUT_CLASS_NAME}
            readOnly={!isCustom}
          />
        </FieldLabel>
      </div>
    </div>
  );
}



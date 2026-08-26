"use client";

import { Check } from "lucide-react";
import { useBrand } from "@/lib/brands/context";
import {
  formatPersonName,
  resolvePrimaryContact,
  useProposalContactInfoDemoState,
} from "./ProposalContactInfoState";
import {
  formatCurrency,
  getAdvancedReceiptManagementPrice,
  getBudgetReportingPrice,
  getProposalPricingSnapshotCleanupCard,
  getProposalPreviewPackages,
  getProjectTrackingPrice,
  getSalesTaxFilingPrice,
  useProposalAssessmentDemoState,
} from "./ProposalCreationWorkspaceDemo";
import { BONUS_OPTIONS } from "./ProposalBonusesDemo";

export default function OfferProposalPreview() {
  const { brand } = useBrand();
  const { assessment } = useProposalAssessmentDemoState();
  const { contactInfo } = useProposalContactInfoDemoState();
  const packages = getProposalPreviewPackages(assessment);
  const cleanupCard = getProposalPricingSnapshotCleanupCard(assessment);
  const primary = resolvePrimaryContact(contactInfo);
  const recipientFirst =
    primary.firstName || contactInfo.owners[0]?.firstName || "there";
  const company = contactInfo.companyName || "your business";

  const addOns = [
    assessment.offerAdvancedReceiptManagement && {
      name: "Advanced Receipt Management",
      price: formatCurrency(getAdvancedReceiptManagementPrice(assessment), "/mo"),
      description: "Organized digital receipts matched to transactions in your books.",
    },
    assessment.offerProjectTracking && {
      name: "Project & Job Tracking",
      price: formatCurrency(getProjectTrackingPrice(assessment), "/mo"),
      description: "Track income and expenses by project, job, or property renovation.",
    },
    assessment.offerBudgetReporting && {
      name: "Budget vs. Actuals Reporting",
      price: formatCurrency(getBudgetReportingPrice(assessment), "/mo"),
      description: "Monthly comparison of your budget against real results.",
    },
    assessment.offerSalesTaxFiling && {
      name: "Sales Tax Filing",
      price: formatCurrency(getSalesTaxFilingPrice(assessment), "/yr"),
      description: "Preparation and filing of your sales tax returns.",
    },
  ].filter(Boolean) as { name: string; price: string; description: string }[];

  const activeComplimentary = [
    assessment.includeRegisteredAgentService && {
      name: "Registered Agent Service",
      description:
        "We act as your registered agent and forward official state correspondence to your designated contact.",
    },
    assessment.includeTaxPreparerCoordinationCall && {
      name: "Tax Preparer Coordination",
      description:
        "We coordinate with your tax preparer, provide organized records, and answer bookkeeping questions during tax prep. Tax preparation and advice are not included.",
    },
  ].filter(Boolean) as { name: string; description: string }[];

  const activeBonuses = BONUS_OPTIONS.filter((bonus) => {
    const selections = assessment.bonusPackageSelections?.[bonus.id];
    if (Array.isArray(selections)) return selections.length > 0;
    return assessment[bonus.assessmentKey as keyof typeof assessment] === true;
  }).map((bonus) => {
    const selections = assessment.bonusPackageSelections?.[bonus.id];
    const pkgIds = Array.isArray(selections) ? selections : packages.map((p) => p.id);
    const pkgNames = pkgIds.map((id) => packages.find((p) => p.id === id)?.name).filter(Boolean);
    return { ...bonus, packages: pkgNames };
  });

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-5 py-12 lg:px-8">

        {/* Header */}
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            {brand.name}
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            Bookkeeping Proposal
          </h1>
          <p className="mt-1 text-base text-slate-500">{company}</p>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
            Hi {recipientFirst}, here are the options we put together for you. Pick the package
            that fits best, or reply with any questions — we are happy to walk you through it.
          </p>
        </div>

        {/* One-time cleanup */}
        {cleanupCard ? (
          <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">
                  One-time · Due at start
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">Historical Cleanup</p>
                {cleanupCard.baseRow ? (
                  <p className="mt-1 text-sm text-slate-600">{cleanupCard.baseRow}</p>
                ) : null}
                <p className="mt-0.5 text-xs text-slate-500">
                  Brings your books current before ongoing monthly service begins.
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xl font-bold text-slate-900">{cleanupCard.amountLabel}</p>
                <p className="mt-0.5 text-xs text-slate-500">Maintain package rate</p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Package cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {packages.map((pkg) => {
            const isDark = pkg.id === "grow";
            const isHighlighted = pkg.isRecommended;
            return (
              <div
                key={pkg.id}
                className={`relative flex flex-col rounded-2xl border p-6 ${
                  isDark
                    ? "border-slate-900 bg-slate-950 text-white"
                    : isHighlighted
                      ? "border-slate-300 bg-white shadow-md ring-1 ring-slate-900/10"
                      : "border-slate-200 bg-white"
                }`}
              >
                {isHighlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                    Recommended
                  </span>
                )}

                <p
                  className={`text-[11px] font-semibold uppercase tracking-wide ${
                    isDark ? "text-white/50" : "text-slate-400"
                  }`}
                >
                  Package
                </p>
                <p className={`mt-1 text-xl font-bold ${isDark ? "text-white" : "text-slate-950"}`}>
                  {pkg.name}
                </p>

                <p className={`mt-3 text-2xl font-bold ${isDark ? "text-white" : "text-slate-950"}`}>
                  {pkg.monthlyLabel}
                </p>
                <p className={`text-xs ${isDark ? "text-white/50" : "text-slate-400"}`}>
                  per month · ongoing
                </p>

                {pkg.oneTimeLabel ? (
                  <p
                    className={`mt-2 text-sm font-medium ${
                      isDark ? "text-white/70" : "text-slate-500"
                    }`}
                  >
                    + {pkg.oneTimeLabel} one-time cleanup
                  </p>
                ) : null}

                <div className={`my-4 border-t ${isDark ? "border-white/10" : "border-slate-100"}`} />

                <p className={`mb-3 text-xs leading-5 ${isDark ? "text-white/60" : "text-slate-500"}`}>
                  {pkg.description}
                </p>

                <ul className="space-y-2">
                  {pkg.includedServices.map((service) => (
                    <li key={service} className="flex items-start gap-2">
                      <Check
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          isDark ? "text-emerald-400" : "text-emerald-600"
                        }`}
                        strokeWidth={2.5}
                      />
                      <span
                        className={`text-sm ${isDark ? "text-white/80" : "text-slate-700"}`}
                      >
                        {service}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className={`mt-4 border-t pt-4 ${isDark ? "border-white/10" : "border-slate-100"}`}>
                  <p className={`text-xs leading-5 ${isDark ? "text-white/50" : "text-slate-400"}`}>
                    {pkg.clientFit}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add-ons */}
        {addOns.length > 0 ? (
          <div className="mt-10">
            <h2 className="text-lg font-semibold text-slate-900">Optional Add-ons</h2>
            <p className="mt-1 text-sm text-slate-500">
              These services can be added to any package at the prices shown.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {addOns.map((addon) => (
                <div
                  key={addon.name}
                  className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{addon.name}</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500">{addon.description}</p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-slate-900">{addon.price}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Free extras / bonuses */}
        {activeBonuses.length > 0 ? (
          <div className="mt-10">
            <h2 className="text-lg font-semibold text-slate-900">Free Extras Included</h2>
            <p className="mt-1 text-sm text-slate-500">
              These are included at no additional charge with the packages listed.
            </p>
            <div className="mt-4 space-y-3">
              {activeBonuses.map((bonus) => (
                <div
                  key={bonus.id}
                  className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4"
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.5} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{bonus.name}</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500">{bonus.description}</p>
                  </div>
                  {bonus.packages.length > 0 && bonus.packages.length < packages.length ? (
                    <p className="shrink-0 text-xs font-medium text-slate-400">
                      {bonus.packages.join(", ")}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Complimentary services */}
        {activeComplimentary.length > 0 ? (
          <div className="mt-10">
            <h2 className="text-lg font-semibold text-slate-900">Complimentary Services</h2>
            <p className="mt-1 text-sm text-slate-500">Included with your engagement at no charge.</p>
            <div className="mt-4 space-y-3">
              {activeComplimentary.map((svc) => (
                <div
                  key={svc.name}
                  className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4"
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.5} />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{svc.name}</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500">{svc.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Footer */}
        <div className="mt-12 border-t border-slate-200 pt-8 text-center">
          <p className="text-sm text-slate-500">
            Questions? Reply to this proposal or reach out directly and we will get back to you
            quickly.
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-700">{brand.name}</p>
        </div>
      </div>
    </main>
  );
}

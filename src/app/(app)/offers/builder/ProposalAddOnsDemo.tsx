"use client";

import { Check, Minus } from "lucide-react";
import { resolveFeaturedMedia, type FeaturedMedia } from "./OfferProposalPreview";
import { useBrand } from "@/lib/brands/context";
import ProposalAppDemoHeader from "./ProposalAppDemoHeader";
import PricingSnapshotSidebar from "./PricingSnapshotSidebar";
import {
  getAdvancedReceiptManagementPrice,
  getBudgetReportingPrice,
  getProposalPricingSnapshotCleanupCard,
  getProposalPricingSnapshotItems,
  getProjectTrackingPrice,
  getSalesTaxFilingPrice,
  useProposalAssessmentDemoState,
  type PackageId,
} from "./ProposalCreationWorkspaceDemo";
import { BONUS_OPTIONS, PACKAGE_COLUMNS } from "./ProposalBonusesDemo";

export default function ProposalAddOnsDemo() {
  const { assessment, updateAssessment } = useProposalAssessmentDemoState();
  const { brand } = useBrand();
  const brandDefaultMediaUrl = brand.theme?.proposalFeaturedMediaUrl ?? null;
  const offered = assessment.offerAdvancedReceiptManagement;
  const calculatedPrice = getAdvancedReceiptManagementPrice({
    ...assessment,
    advancedReceiptManagementPriceOverride: null,
  });
  const price = getAdvancedReceiptManagementPrice(assessment);
  const transactionLabel = assessment.transactionBand && assessment.transactionBand !== "unknown"
    ? `${assessment.transactionBand} monthly transactions`
    : "transaction volume not yet confirmed";
  const hasKnownTransactionRange = Boolean(assessment.transactionBand && assessment.transactionBand !== "unknown");
  const projectTrackingPrice = getProjectTrackingPrice(assessment);
  const budgetReportingPrice = getBudgetReportingPrice(assessment);
  const salesTaxFilingPrice = getSalesTaxFilingPrice(assessment);
  const pricingItems = getProposalPricingSnapshotItems(assessment);
  const cleanupCard = getProposalPricingSnapshotCleanupCard(assessment);

  function bonusIsApplicable(bonus: (typeof BONUS_OPTIONS)[number]) {
    const isRealEstateBookSet =
      assessment.bookSetType === "real-estate-only" || assessment.bookSetType === "mixed-books";
    if (bonus.id === "stessa-migration") return assessment.platformMigrationEnabled && assessment.ongoingBookkeepingPlatform === "stessa";
    if (bonus.id === "property-reporting-setup" || bonus.id === "real-estate-chart-of-accounts") {
      return isRealEstateBookSet;
    }
    if (bonus.id === "new-quickbooks-file") {
      return isRealEstateBookSet && assessment.ongoingBookkeepingPlatform === "qbo";
    }
    return true;
  }

  function selectedBonusPackages(bonus: (typeof BONUS_OPTIONS)[number]) {
    if (!bonusIsApplicable(bonus)) return [];
    const saved = assessment.bonusPackageSelections?.[bonus.id];
    if (Array.isArray(saved)) return saved;
    return assessment[bonus.assessmentKey] ? PACKAGE_COLUMNS.map(({ id }) => id) : [];
  }

  function toggleBonusPackage(bonus: (typeof BONUS_OPTIONS)[number], packageId: PackageId) {
    const current = selectedBonusPackages(bonus);
    const next = current.includes(packageId) ? current.filter((id) => id !== packageId) : [...current, packageId];
    updateAssessment("bonusPackageSelections", { ...assessment.bonusPackageSelections, [bonus.id]: next });
    updateAssessment(bonus.assessmentKey, next.length > 0);
  }

  function setAllBonusesForPackage(packageId: PackageId, checked: boolean) {
    const nextSelections = { ...assessment.bonusPackageSelections };
    for (const bonus of BONUS_OPTIONS) {
      if (!bonusIsApplicable(bonus)) continue;
      const current = selectedBonusPackages(bonus);
      nextSelections[bonus.id] = checked ? Array.from(new Set([...current, packageId])) : current.filter((id) => id !== packageId);
    }
    updateAssessment("bonusPackageSelections", nextSelections);
    for (const bonus of BONUS_OPTIONS) updateAssessment(bonus.assessmentKey, (nextSelections[bonus.id]?.length ?? 0) > 0);
  }

  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto w-full max-w-[1720px] px-5 py-6 lg:px-8">
        <ProposalAppDemoHeader
          currentStep="add-ons"
          previousHref="/offers/calculator"
          viewProposalAsNext
        />

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_440px] 2xl:grid-cols-[minmax(0,1.55fr)_470px]">
          <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-950">Add-ons</h1>
          <p className="mt-1 text-sm text-slate-500">
            Choose which optional paid services the lead may add to their package. Add-ons are not included unless the lead selects them.
          </p>

          <section className="mt-8">
            <h2 className="text-lg font-bold text-slate-950">Intro Media</h2>
            <p className="mt-1 text-sm text-slate-500">
              Paste an image URL or a YouTube / Vimeo link to show a featured visual on the first screen of the proposal.
            </p>
            <div className="mt-3 rounded-xl border border-slate-200 proposal-builder-card p-5">
              <label className="block text-sm font-semibold text-slate-700">
                Image or video URL
                <input
                  type="url"
                  placeholder={brandDefaultMediaUrl ? "Using brand default — paste to override" : "https://…"}
                  value={assessment.featuredMediaUrl ?? ""}
                  onChange={(e) => updateAssessment("featuredMediaUrl", e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-brandnavy focus:ring-2 focus:ring-brandnavy/20"
                />
              </label>
              {assessment.featuredMediaUrl ? (
                <FeaturedMediaPreview url={assessment.featuredMediaUrl} />
              ) : brandDefaultMediaUrl ? (
                <div className="mt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Brand default</p>
                  <FeaturedMediaPreview url={brandDefaultMediaUrl} />
                </div>
              ) : null}
            </div>
          </section>

          <h2 className="mt-10 text-lg font-bold text-slate-950">Optional Add-ons</h2>
          <section className={`mt-3 rounded-xl border p-5 ${offered ? "border-brandnavy-300 bg-brandnavy-50/30" : "border-slate-200 proposal-builder-card"}`}>
            <div className="flex items-start gap-4">
              <button
                type="button"
                role="checkbox"
                aria-checked={offered}
                onClick={() => updateAssessment("offerAdvancedReceiptManagement", !offered)}
                className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border transition ${offered ? "border-brandnavy bg-brandnavy text-white" : "border-slate-300 bg-white text-transparent"}`}
              >
                <Check className="h-4 w-4" strokeWidth={3} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-slate-950">Advanced Receipt Management</h2>
                    <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">
                      Enhanced receipt collection, organization, and matching support. The lead decides whether to add it after selecting a package.
                    </p>
                  </div>
                  <label className="text-sm font-semibold text-slate-700">
                    Monthly price
                    <span className="mt-1 flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2">
                      <span className="mr-1 text-slate-400">$</span>
                      <input
                        type="number"
                        min={calculatedPrice}
                        step="1"
                        disabled={!offered}
                        value={price}
                        onChange={(event) => updateAssessment("advancedReceiptManagementPriceOverride", Math.max(calculatedPrice, Number(event.target.value) || 0))}
                        className="w-24 bg-transparent text-right outline-none disabled:text-slate-400"
                      />
                    </span>
                  </label>
                </div>
                <div className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                  Minimum based on <span className="font-semibold text-slate-900">{transactionLabel}</span>{hasKnownTransactionRange ? " at $1 per transaction, using the top of the selected range" : " using the temporary default until a range is selected"}: <span className="font-semibold text-slate-900">${calculatedPrice.toLocaleString("en-US")}/mo</span>
                  {assessment.advancedReceiptManagementPriceOverride !== null ? (
                    <button
                      type="button"
                      onClick={() => updateAssessment("advancedReceiptManagementPriceOverride", null)}
                      className="ml-3 font-semibold text-brandnavy underline underline-offset-2"
                    >
                      Use calculated price
                    </button>
                  ) : null}
                </div>
                <p className={`mt-4 text-xs font-semibold uppercase tracking-wide ${offered ? "text-emerald-700" : "text-slate-400"}`}>
                  {offered ? "Offered to the lead — not included by default" : "Not offered in this proposal"}
                </p>
              </div>
            </div>
          </section>

          <section className={`mt-4 rounded-xl border p-5 ${assessment.offerProjectTracking ? "border-brandnavy-300 bg-brandnavy-50/30" : "border-slate-200 proposal-builder-card"}`}>
            <div className="flex items-start gap-4">
              <button type="button" role="checkbox" aria-checked={assessment.offerProjectTracking} onClick={() => updateAssessment("offerProjectTracking", !assessment.offerProjectTracking)} className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border transition ${assessment.offerProjectTracking ? "border-brandnavy bg-brandnavy text-white" : "border-slate-300 bg-white text-transparent"}`}><Check className="h-4 w-4" strokeWidth={3} /></button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><h2 className="font-semibold text-slate-950">Project Tracking</h2><p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">Offer project income, cost, and profitability tracking to leads who choose Improve or Grow. This add-on is not available with Maintain.</p></div>
                  <label className="text-sm font-semibold text-slate-700">Monthly price<span className="mt-1 flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2"><span className="mr-1 text-slate-400">$</span><input type="number" min="0" step="1" disabled={!assessment.offerProjectTracking} value={projectTrackingPrice} onChange={(event) => updateAssessment("projectTrackingPriceOverride", Math.max(0, Number(event.target.value) || 0))} className="w-24 bg-transparent text-right outline-none disabled:text-slate-400" /></span></label>
                </div>
                <div className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">Default monthly price: <span className="font-semibold text-slate-900">$150</span>{assessment.projectTrackingPriceOverride !== null ? <button type="button" onClick={() => updateAssessment("projectTrackingPriceOverride", null)} className="ml-3 font-semibold text-brandnavy underline underline-offset-2">Use default price</button> : null}</div>
                <p className={`mt-4 text-xs font-semibold uppercase tracking-wide ${assessment.offerProjectTracking ? "text-emerald-700" : "text-slate-400"}`}>{assessment.offerProjectTracking ? "Offered with Improve and Grow · unavailable with Maintain" : "Not offered in this proposal"}</p>
              </div>
            </div>
          </section>

          <section className={`mt-4 rounded-xl border p-5 ${assessment.offerBudgetReporting ? "border-brandnavy-300 bg-brandnavy-50/30" : "border-slate-200 proposal-builder-card"}`}>
            <div className="flex items-start gap-4">
              <button type="button" role="checkbox" aria-checked={assessment.offerBudgetReporting} onClick={() => updateAssessment("offerBudgetReporting", !assessment.offerBudgetReporting)} className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border transition ${assessment.offerBudgetReporting ? "border-brandnavy bg-brandnavy text-white" : "border-slate-300 bg-white text-transparent"}`}><Check className="h-4 w-4" strokeWidth={3} /></button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><h2 className="font-semibold text-slate-950">Budget Setup &amp; Budget vs. Actuals Reporting</h2><p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">We build the client's budget and provide recurring budget-vs-actuals reporting to track performance against it. The lead decides whether to add it after selecting a package.</p></div>
                  <label className="text-sm font-semibold text-slate-700">Monthly price<span className="mt-1 flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2"><span className="mr-1 text-slate-400">$</span><input type="number" min="0" step="1" disabled={!assessment.offerBudgetReporting} value={budgetReportingPrice} onChange={(event) => updateAssessment("budgetReportingPriceOverride", Math.max(0, Number(event.target.value) || 0))} className="w-24 bg-transparent text-right outline-none disabled:text-slate-400" /></span></label>
                </div>
                <div className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">Default monthly price: <span className="font-semibold text-slate-900">$150</span>{assessment.budgetReportingPriceOverride !== null ? <button type="button" onClick={() => updateAssessment("budgetReportingPriceOverride", null)} className="ml-3 font-semibold text-brandnavy underline underline-offset-2">Use default price</button> : null}</div>
                <p className={`mt-4 text-xs font-semibold uppercase tracking-wide ${assessment.offerBudgetReporting ? "text-emerald-700" : "text-slate-400"}`}>{assessment.offerBudgetReporting ? "Offered to the lead — not included by default" : "Not offered in this proposal"}</p>
              </div>
            </div>
          </section>

          <section className={`mt-4 rounded-xl border p-5 ${assessment.offerSalesTaxFiling ? "border-brandnavy-300 bg-brandnavy-50/30" : "border-slate-200 proposal-builder-card"}`}>
            <div className="flex items-start gap-4">
              <button type="button" role="checkbox" aria-checked={assessment.offerSalesTaxFiling} onClick={() => updateAssessment("offerSalesTaxFiling", !assessment.offerSalesTaxFiling)} className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border transition ${assessment.offerSalesTaxFiling ? "border-brandnavy bg-brandnavy text-white" : "border-slate-300 bg-white text-transparent"}`}><Check className="h-4 w-4" strokeWidth={3} /></button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><h2 className="font-semibold text-slate-950">Sales Tax Filing &amp; Remittance</h2><p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">We calculate, file, and remit the client's sales tax payments to the comptroller on their behalf. The lead decides whether to add it after selecting a package.</p></div>
                  <label className="text-sm font-semibold text-slate-700">Monthly price<span className="mt-1 flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2"><span className="mr-1 text-slate-400">$</span><input type="number" min="0" step="1" disabled={!assessment.offerSalesTaxFiling} value={salesTaxFilingPrice} onChange={(event) => updateAssessment("salesTaxFilingPriceOverride", Math.max(0, Number(event.target.value) || 0))} className="w-24 bg-transparent text-right outline-none disabled:text-slate-400" /></span></label>
                </div>
                <div className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">Default monthly price: <span className="font-semibold text-slate-900">$650</span>{assessment.salesTaxFilingPriceOverride !== null ? <button type="button" onClick={() => updateAssessment("salesTaxFilingPriceOverride", null)} className="ml-3 font-semibold text-brandnavy underline underline-offset-2">Use default price</button> : null}</div>
                <p className={`mt-4 text-xs font-semibold uppercase tracking-wide ${assessment.offerSalesTaxFiling ? "text-emerald-700" : "text-slate-400"}`}>{assessment.offerSalesTaxFiling ? "Offered to the lead — not included by default" : "Not offered in this proposal"}</p>
              </div>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold text-slate-950">Complimentary Services</h2>
            <p className="mt-1 text-sm text-slate-500">
              Value-adding services that can be included in the offer at no additional charge.
            </p>

            <div className={`mt-3 rounded-xl border p-5 ${assessment.includeTaxPreparerCoordinationCall ? "border-brandnavy-300 bg-brandnavy-50/30" : "border-slate-200 proposal-builder-card"}`}>
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={assessment.includeTaxPreparerCoordinationCall}
                  onClick={() => updateAssessment("includeTaxPreparerCoordinationCall", !assessment.includeTaxPreparerCoordinationCall)}
                  className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border transition ${assessment.includeTaxPreparerCoordinationCall ? "border-brandnavy bg-brandnavy text-white" : "border-slate-300 bg-white text-transparent"}`}
                >
                  <Check className="h-4 w-4" strokeWidth={3} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-slate-950">Tax Preparer Coordination</h3>
                      <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">
                        We&apos;ll coordinate with the client&apos;s tax preparer, provide organized bookkeeping records, and answer bookkeeping questions that arise during tax preparation. Tax preparation and tax advice are not included.
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-700">Included at no additional charge</p>
                  </div>
                  <p className={`mt-4 text-xs font-semibold uppercase tracking-wide ${assessment.includeTaxPreparerCoordinationCall ? "text-emerald-700" : "text-slate-400"}`}>
                    {assessment.includeTaxPreparerCoordinationCall ? "Included in this proposal" : "Not included in this proposal"}
                  </p>
                </div>
              </div>
            </div>

            <div className={`mt-3 rounded-xl border p-5 ${assessment.includeRegisteredAgentService ? "border-brandnavy-300 bg-brandnavy-50/30" : "border-slate-200 proposal-builder-card"}`}>
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={assessment.includeRegisteredAgentService}
                  onClick={() => updateAssessment("includeRegisteredAgentService", !assessment.includeRegisteredAgentService)}
                  className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border transition ${assessment.includeRegisteredAgentService ? "border-brandnavy bg-brandnavy text-white" : "border-slate-300 bg-white text-transparent"}`}
                >
                  <Check className="h-4 w-4" strokeWidth={3} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-slate-950">Registered Agent Service</h3>
                      <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">
                        We will act as the business&apos;s registered agent and forward official state correspondence to the designated contact.
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-700">Included at no additional charge</p>
                  </div>
                  <p className={`mt-4 text-xs font-semibold uppercase tracking-wide ${assessment.includeRegisteredAgentService ? "text-emerald-700" : "text-slate-400"}`}>
                    {assessment.includeRegisteredAgentService ? "Included in this proposal · $0/year" : "Not included in this proposal"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold text-slate-950">Bonuses</h2>
            <p className="mt-1 text-sm text-slate-500">Check the packages that should include each free extra.</p>
            <div className="proposal-builder-card mt-3 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full table-fixed border-collapse">
                <colgroup><col />{PACKAGE_COLUMNS.map(({ id }) => <col key={id} className="w-20 sm:w-24" />)}</colgroup>
                <thead><tr className="bg-slate-50"><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Bonus</th>{PACKAGE_COLUMNS.map(({ id, label }) => {
                  const applicable = BONUS_OPTIONS.filter(bonusIsApplicable);
                  const selectedCount = applicable.filter((bonus) => selectedBonusPackages(bonus).includes(id)).length;
                  const allChecked = applicable.length > 0 && selectedCount === applicable.length;
                  const partlyChecked = selectedCount > 0 && !allChecked;
                  return <th key={id} className="px-1 py-2 text-center text-sm font-bold text-brandnavy"><span className="block">{label}</span><button type="button" role="checkbox" aria-checked={partlyChecked ? "mixed" : allChecked} onClick={() => setAllBonusesForPackage(id, !allChecked)} className={`mx-auto mt-1 grid h-7 w-7 place-items-center rounded-md border transition ${allChecked || partlyChecked ? "border-brandnavy bg-brandnavy text-white" : "border-slate-300 bg-white text-transparent"}`}>{partlyChecked ? <Minus className="h-4 w-4" strokeWidth={3} /> : <Check className="h-4 w-4" strokeWidth={3} />}</button></th>;
                })}</tr></thead>
                <tbody>{BONUS_OPTIONS.map((bonus, index) => {
                  const selected = selectedBonusPackages(bonus);
                  return <tr key={bonus.id} className={`border-t border-slate-200 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}><td className="px-4 py-3"><p className="font-semibold text-slate-950">{bonus.name}</p><p className="mt-0.5 text-xs leading-4 text-slate-500">{bonus.description}</p></td>{PACKAGE_COLUMNS.map(({ id, label }) => {
                    const applicable = bonusIsApplicable(bonus);
                    const checked = selected.includes(id);
                    return <td key={id} className="px-1 py-3 text-center">{applicable ? <button type="button" role="checkbox" aria-checked={checked} aria-label={`${checked ? "Remove" : "Add"} ${bonus.name} ${checked ? "from" : "to"} ${label}`} onClick={() => toggleBonusPackage(bonus, id)} className={`mx-auto grid h-7 w-7 place-items-center rounded-md border transition ${checked ? "border-brandnavy bg-brandnavy text-white" : "border-slate-300 bg-white text-transparent"}`}><Check className="h-4 w-4" strokeWidth={3} /></button> : <span className="text-xs font-medium text-slate-300">N/A</span>}</td>;
                  })}</tr>;
                })}</tbody>
              </table>
            </div>
          </section>
          </div>
          <PricingSnapshotSidebar items={pricingItems} cleanupCard={cleanupCard} />
        </div>
      </section>
    </main>
  );
}

function FeaturedMediaPreview({ url }: { url: string }) {
  const media: FeaturedMedia = resolveFeaturedMedia(url);
  if (!media) {
    return (
      <p className="mt-3 text-xs font-semibold text-rose-600">Could not parse this URL as an image or video.</p>
    );
  }
  if (media.type === "image") {
    return (
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={media.url} alt="Preview" className="h-auto max-h-64 w-full object-cover" />
      </div>
    );
  }
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
      <div className="aspect-video">
        <iframe
          src={media.embedUrl}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
    </div>
  );
}

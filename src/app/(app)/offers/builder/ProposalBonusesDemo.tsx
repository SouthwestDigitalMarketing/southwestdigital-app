"use client";

import { Check, Minus } from "lucide-react";
import ProposalAppDemoHeader from "./ProposalAppDemoHeader";
import {
  useProposalAssessmentDemoState,
  type PackageId,
  type ProposalBonusId,
} from "./ProposalCreationWorkspaceDemo";

export const PACKAGE_COLUMNS: Array<{ id: PackageId; label: string }> = [
  { id: "grow", label: "Grow" },
  { id: "improve", label: "Improve" },
  { id: "maintain", label: "Maintain" },
];

export const BONUS_OPTIONS = [
  { id: "stessa-migration", assessmentKey: "includeConditionalStessaMigration", name: "QuickBooks to Stessa Migration", description: "We will move the client's books to Stessa for free when they buy the cleanup and monthly bookkeeping in this offer." },
  { id: "tax-preparer-coordination", assessmentKey: "includeTaxPreparerCoordinationCall", name: "Tax Pro Call", description: "We will meet with the client's tax pro one time. We will answer book questions and make sure they get what they need for year-end taxes." },
  { id: "property-reporting-setup", assessmentKey: "includePropertyLevelReportingSetup", name: "Reports by Property", description: "We will set up the books so the client can see income and costs for each property." },
  { id: "document-organization", assessmentKey: "includeDocumentOrganizationSetup", name: "Organized, Audit-Ready Records", description: "We replace paper files and loose digital files with one clear system. The client uploads records to the portal. We organize them and link them to the right items in the books." },
  { id: "quarterly-review", assessmentKey: "includeQuarterlyFinancialReview", name: "First Quarterly Review", description: "After the first full quarter, we will meet with the client to review reports, answer questions, and plan the next steps." },
  { id: "doublehq-client-portal", assessmentKey: "includeDoubleHqClientPortal", name: "DoubleHQ Client Portal", description: "The client gets one online place to talk with our team, send files, view requests, and check the work in progress." },
  { id: "real-estate-chart-of-accounts", assessmentKey: "includeRealEstateChartOfAccounts", name: "Real Estate Chart of Accounts", description: "We will add our real estate Chart of Accounts to the client's current QuickBooks file. This makes reports easier to read and keeps the books consistent." },
  { id: "new-quickbooks-file", assessmentKey: "includeNewQuickBooksFileSetup", name: "New QuickBooks Setup", description: "If a fresh start is best, we will build a new QuickBooks file for monthly bookkeeping. It will include our Real Estate Chart of Accounts." },
] as const satisfies ReadonlyArray<{
  id: ProposalBonusId;
  assessmentKey:
    | "includeConditionalStessaMigration"
    | "includeTaxPreparerCoordinationCall"
    | "includePropertyLevelReportingSetup"
    | "includeDocumentOrganizationSetup"
    | "includeQuarterlyFinancialReview"
    | "includeDoubleHqClientPortal"
    | "includeRealEstateChartOfAccounts"
    | "includeNewQuickBooksFileSetup";
  name: string;
  description: string;
}>;

export default function ProposalBonusesDemo() {
  const { assessment, updateAssessment } = useProposalAssessmentDemoState();

  function isApplicable(bonus: (typeof BONUS_OPTIONS)[number]) {
    if (bonus.id === "stessa-migration") {
      return assessment.platformMigrationEnabled && assessment.ongoingBookkeepingPlatform === "stessa";
    }
    if (bonus.id === "new-quickbooks-file") {
      return assessment.ongoingBookkeepingPlatform === "qbo";
    }
    return true;
  }

  function selectedPackages(bonus: (typeof BONUS_OPTIONS)[number]) {
    if (!isApplicable(bonus)) return [];
    const saved = assessment.bonusPackageSelections?.[bonus.id];
    if (Array.isArray(saved)) return saved;
    return assessment[bonus.assessmentKey] ? PACKAGE_COLUMNS.map(({ id }) => id) : [];
  }

  function togglePackage(bonus: (typeof BONUS_OPTIONS)[number], packageId: PackageId) {
    if (!isApplicable(bonus)) return;
    const current = selectedPackages(bonus);
    const next = current.includes(packageId)
      ? current.filter((id) => id !== packageId)
      : [...current, packageId];

    updateAssessment("bonusPackageSelections", {
      ...assessment.bonusPackageSelections,
      [bonus.id]: next,
    });
    updateAssessment(bonus.assessmentKey, next.length > 0);
  }

  function setPackageForAll(packageId: PackageId, checked: boolean) {
    const nextSelections = { ...assessment.bonusPackageSelections };

    for (const bonus of BONUS_OPTIONS) {
      if (!isApplicable(bonus)) continue;
      const current = selectedPackages(bonus);
      nextSelections[bonus.id] = checked
        ? Array.from(new Set([...current, packageId]))
        : current.filter((id) => id !== packageId);
    }

    updateAssessment("bonusPackageSelections", nextSelections);
    for (const bonus of BONUS_OPTIONS) {
      updateAssessment(bonus.assessmentKey, nextSelections[bonus.id].length > 0);
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto w-full max-w-[1720px] px-5 py-6 lg:px-8">
        <ProposalAppDemoHeader
          currentStep="add-ons"
          previousHref="/offers/add-ons"
          nextHref="/offers"
          onExpandAll={() => undefined}
          onCollapseAll={() => undefined}
        />

        <div className="mx-auto mt-8 max-w-5xl">
          <div className="mb-3">
            <h1 className="text-2xl font-bold text-slate-950">Choose Bonuses</h1>
            <p className="mt-1 text-sm text-slate-500">
              Check the packages that should include each free extra.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col />
                {PACKAGE_COLUMNS.map(({ id }) => <col key={id} className="w-20 sm:w-24" />)}
              </colgroup>
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Bonus</th>
                  {PACKAGE_COLUMNS.map(({ id, label }) => {
                    const applicableBonuses = BONUS_OPTIONS.filter(isApplicable);
                    const selectedCount = applicableBonuses.filter((bonus) => selectedPackages(bonus).includes(id)).length;
                    const allChecked = applicableBonuses.length > 0 && selectedCount === applicableBonuses.length;
                    const partlyChecked = selectedCount > 0 && !allChecked;
                    return (
                      <th key={id} className="px-1 py-2 text-center text-sm font-bold text-brandnavy">
                        <span className="block">{label}</span>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={partlyChecked ? "mixed" : allChecked}
                          aria-label={`${allChecked ? "Remove all bonuses from" : "Add all bonuses to"} ${label}`}
                          onClick={() => setPackageForAll(id, !allChecked)}
                          className={`mx-auto mt-1 grid h-7 w-7 cursor-pointer place-items-center rounded-md border transition ${allChecked || partlyChecked ? "border-brandnavy bg-brandnavy text-white" : "border-slate-300 bg-white text-transparent hover:border-brandnavy-300"}`}
                        >
                          {partlyChecked ? <Minus className="h-4 w-4" strokeWidth={3} /> : <Check className="h-4 w-4" strokeWidth={3} />}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {BONUS_OPTIONS.map((bonus, index) => {
                  const selected = selectedPackages(bonus);
                  return (
                    <tr key={bonus.id} className={`border-t border-slate-200 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
                      <td className="px-4 py-3 align-middle">
                        <p className="font-semibold text-slate-950">{bonus.name}</p>
                        <p className="mt-0.5 text-xs leading-4 text-slate-500">{bonus.description}</p>
                      </td>
                      {PACKAGE_COLUMNS.map(({ id, label }) => {
                        const applicable = isApplicable(bonus);
                        const checked = selected.includes(id);
                        return (
                          <td key={id} className="px-1 py-3 text-center align-middle">
                            {applicable ? <button
                              type="button"
                              role="checkbox"
                              aria-checked={checked}
                              aria-label={`${checked ? "Remove" : "Add"} ${bonus.name} ${checked ? "from" : "to"} ${label}`}
                              onClick={() => togglePackage(bonus, id)}
                              className={`mx-auto grid h-7 w-7 cursor-pointer place-items-center rounded-md border transition ${checked ? "border-brandnavy bg-brandnavy text-white" : "border-slate-300 bg-white text-transparent hover:border-brandnavy-300"}`}
                            >
                              <Check className="h-4 w-4" strokeWidth={3} />
                            </button> : <span className="text-xs font-medium text-slate-300">N/A</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}

"use client";

import { useBrand } from "@/lib/brands/context";
import {
  formatPersonName,
  resolvePrimaryContact,
  useProposalContactInfoDemoState,
} from "./ProposalContactInfoState";
import {
  getProposalPricingSnapshotCleanupCard,
  getProposalPricingSnapshotItems,
  useProposalAssessmentDemoState,
} from "./ProposalCreationWorkspaceDemo";

export default function OfferProposalPreview() {
  const { brand } = useBrand();
  const { assessment } = useProposalAssessmentDemoState();
  const { contactInfo } = useProposalContactInfoDemoState();
  const items = getProposalPricingSnapshotItems(assessment);
  const cleanupCard = getProposalPricingSnapshotCleanupCard(assessment);
  const primary = resolvePrimaryContact(contactInfo);
  const recipient =
    formatPersonName(primary.firstName, primary.lastName) || contactInfo.companyName || "there";
  const company = contactInfo.companyName || "your business";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-5 py-10 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          {brand.name}
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Bookkeeping proposal</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Hi {recipient.split(" ")[0] || "there"}. Here are the options we put together for {company}.
          Pick the package that fits, or reply with questions.
        </p>

        {cleanupCard ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  One-time
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">Historical cleanup</p>
                {cleanupCard.baseRow ? (
                  <p className="mt-1 text-sm text-slate-500">{cleanupCard.baseRow}</p>
                ) : null}
              </div>
              <p className="text-lg font-semibold text-slate-900">{cleanupCard.amountLabel}</p>
            </div>
          </div>
        ) : null}

        {assessment.includeRegisteredAgentService ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Complimentary service
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">Registered Agent Service</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              We&apos;ll act as your registered agent and forward official state correspondence to your designated contact, at no additional charge.
            </p>
          </div>
        ) : null}

        {assessment.includeTaxPreparerCoordinationCall ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Complimentary service
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">Tax Preparer Coordination</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              We&apos;ll coordinate with your tax preparer, provide organized bookkeeping records, and answer bookkeeping questions during tax preparation. Tax preparation and tax advice are not included.
            </p>
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex flex-col rounded-2xl border p-5 ${
                item.id === "grow"
                  ? "border-slate-950 bg-slate-950 text-white"
                  : item.isRecommended
                    ? "border-slate-900 bg-white shadow-sm"
                    : "border-slate-200 bg-white"
              }`}
            >
              {item.isRecommended ? (
                <p
                  className={`text-[11px] font-semibold uppercase tracking-wide ${
                    item.id === "grow" ? "text-white/70" : "text-slate-400"
                  }`}
                >
                  Recommended
                </p>
              ) : (
                <p className="text-[11px] font-semibold uppercase tracking-wide text-transparent">
                  Package
                </p>
              )}
              <p className="mt-2 text-xl font-semibold">{item.name}</p>
              <p className="mt-4 text-2xl font-semibold">{item.monthlyLabel}</p>
              <p
                className={`mt-2 text-sm ${item.id === "grow" ? "text-white/70" : "text-slate-500"}`}
              >
                Ongoing monthly bookkeeping
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

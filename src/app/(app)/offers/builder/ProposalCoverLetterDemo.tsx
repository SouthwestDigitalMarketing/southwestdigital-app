"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import ProposalAppDemoHeader from "./ProposalAppDemoHeader";
import PricingSnapshotSidebar from "./PricingSnapshotSidebar";
import {
  getProposalPricingSnapshotCleanupCard,
  getProposalPricingSnapshotItems,
  useProposalAssessmentDemoState,
} from "./ProposalCreationWorkspaceDemo";
import {
  formatPersonName,
  resolvePrimaryContact,
  useProposalContactInfoDemoState,
} from "./ProposalContactInfoState";
import { useBrand } from "@/lib/brands/context";
import { getOfferPublicPathAction } from "../who/actions";

const INPUT_CLASS_NAME =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-brandnavy focus:outline-none focus:ring-2 focus:ring-brandnavy/10";
const FIELD_LABEL_CLASS =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500";

export default function ProposalCoverLetterDemo() {
  const { brand } = useBrand();
  const { assessment } = useProposalAssessmentDemoState();
  const { contactInfo } = useProposalContactInfoDemoState();
  const [copied, setCopied] = useState(false);
  const [publicPath, setPublicPath] = useState("");

  const resolvedPrimaryContact = resolvePrimaryContact(contactInfo);
  const fallbackOwner = contactInfo.owners[0];
  const recipientFirstName =
    resolvedPrimaryContact.firstName || fallbackOwner?.firstName || "there";
  const recipientEmail = resolvedPrimaryContact.email || fallbackOwner?.email || "";
  const recipientName =
    formatPersonName(resolvedPrimaryContact.firstName, resolvedPrimaryContact.lastName) ||
    (fallbackOwner ? formatPersonName(fallbackOwner.firstName, fallbackOwner.lastName) : "");
  const companyName = contactInfo.companyName || "your business";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const proposalUrl = publicPath ? `${origin}${publicPath}` : "";
  const subject = `Your bookkeeping proposal for ${companyName}`;
  const emailBody = `Hi ${recipientFirstName},

Thank you for taking the time to meet with me. I put together a bookkeeping proposal for ${companyName}.

You can review it here:
${proposalUrl || "[Publish changes to generate the proposal link]"}

The proposal shows your service options, what each option includes, and the price. You can pick the option that works best for you.

${brand.name} would be glad to help you get clear, organized books and reach your goals.

Thank you,
${brand.name}`;
  const completeEmail = `To: ${recipientName}${recipientEmail ? ` <${recipientEmail}>` : ""}
Subject: ${subject}

${emailBody}`;

  const pricingItems = getProposalPricingSnapshotItems(assessment);
  const cleanupCard = getProposalPricingSnapshotCleanupCard(assessment);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  useEffect(() => {
    const offerId = new URLSearchParams(window.location.search).get("offer");
    if (!offerId) return;
    void getOfferPublicPathAction(offerId).then((path) => {
      setPublicPath(path ?? "");
    });
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(completeEmail);
      setCopied(true);
    } catch {
      // Clipboard access can fail in an insecure browser context.
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto w-full max-w-[1720px] px-5 py-6 lg:px-8">
        <ProposalAppDemoHeader
          currentStep="cover"
          previousHref="/offers/add-ons"
        />

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_440px] 2xl:grid-cols-[minmax(0,1.55fr)_470px]">
          <section className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-slate-950">Client Email</h1>
              <p className="mt-1 text-sm text-slate-500">
                Copy this email and send it to the client with their proposal link.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className={FIELD_LABEL_CLASS}>To</span>
                <input readOnly value={recipientEmail} className={INPUT_CLASS_NAME} />
              </label>
              <label className="grid gap-2">
                <span className={FIELD_LABEL_CLASS}>Subject</span>
                <input readOnly value={subject} className={INPUT_CLASS_NAME} />
              </label>
            </div>

            <label className="grid gap-2">
              <span className={FIELD_LABEL_CLASS}>Proposal Link</span>
              <span className="flex gap-2">
                <input readOnly value={proposalUrl || "Publish changes to generate a client link."} className={INPUT_CLASS_NAME} />
                {proposalUrl ? (
                  <a
                    href={proposalUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open proposal link"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-300 text-slate-600 transition hover:bg-slate-50"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-300">
                    <ExternalLink className="h-4 w-4" />
                  </span>
                )}
              </span>
            </label>

            <label className="grid gap-2">
              <span className={FIELD_LABEL_CLASS}>Email</span>
              <textarea readOnly rows={17} value={emailBody} className={`${INPUT_CLASS_NAME} leading-6`} />
            </label>

            <button
              type="button"
              onClick={() => void handleCopy()}
              disabled={!proposalUrl}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy Email"}
            </button>
          </section>

          <PricingSnapshotSidebar items={pricingItems} cleanupCard={cleanupCard} />
        </div>
      </section>
    </main>
  );
}

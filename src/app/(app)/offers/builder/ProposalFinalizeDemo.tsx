"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Save, Send, Upload } from "lucide-react";
import ProposalAppDemoHeader from "./ProposalAppDemoHeader";
import PricingSnapshotSidebar from "./PricingSnapshotSidebar";
import { readProposalBuilderLocalState } from "./ProposalBuilderStorage";
import type { ContactInfoState } from "./ProposalContactInfoState";
import {
  getProposalPricingSnapshotCleanupCard,
  getProposalPricingSnapshotData,
  getProposalPricingSnapshotItems,
  useProposalAssessmentDemoState,
  type AssessmentState,
} from "./ProposalCreationWorkspaceDemo";
import {
  getOfferPublicPathAction,
  publishOfferChangesAction,
  saveOfferDraftAction,
  syncOfferContactsAction,
} from "../who/actions";

function withQuery(href: string, query: string) {
  if (!query) return href;
  return `${href}${href.includes("?") ? "&" : "?"}${query}`;
}

export default function ProposalFinalizeDemo() {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const offerId = searchParams.get("offer");
  const { assessment } = useProposalAssessmentDemoState();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">(offerId ? "saved" : "idle");
  const [publishStatus, setPublishStatus] = useState<"idle" | "publishing" | "published" | "error">("idle");
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    if (!offerId) return;
    void getOfferPublicPathAction(offerId).then((publicPath) => {
      if (publicPath) {
        setSaveStatus("saved");
        setPublishStatus("published");
      }
    });
  }, [offerId]);

  async function saveDraft() {
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const localState = readProposalBuilderLocalState();
      const contactInfo = localState.contactInfo as ContactInfoState | undefined;
      const people =
        contactInfo?.owners
          .map((owner) => ({
            contactId: owner.crmContactId ?? "",
            firstName: owner.firstName,
            lastName: owner.lastName,
            email: owner.email,
            phone: owner.phone,
            roleTitle:
              contactInfo.primaryContact.ownerId === owner.id
                ? contactInfo.primaryContact.role
                : "",
          }))
          .filter((person) => person.contactId) ?? [];
      if (people.length > 0) {
        await syncOfferContactsAction({
          companyName: contactInfo?.companyName ?? "",
          people,
        });
      }
      if (offerId) {
        await saveOfferDraftAction(offerId, {
          contactInfo,
          assessment: localState.assessment,
          isTestProposal: localState.assessment?.isTestProposal === true,
          pricing: getProposalPricingSnapshotData(localState.assessment as AssessmentState).packagePricing,
        });
      }
      setSaveStatus("saved");
    } catch (error) {
      setSaveStatus("error");
      setSaveError(error instanceof Error ? error.message : "Save failed");
    }
  }

  async function publishOffer() {
    setPublishStatus("publishing");
    setPublishError(null);
    try {
      const localState = readProposalBuilderLocalState();
      const contactInfo = localState.contactInfo as ContactInfoState | undefined;
      const people =
        contactInfo?.owners
          .map((owner) => ({
            contactId: owner.crmContactId ?? "",
            firstName: owner.firstName,
            lastName: owner.lastName,
            email: owner.email,
            phone: owner.phone,
            roleTitle:
              contactInfo.primaryContact.ownerId === owner.id
                ? contactInfo.primaryContact.role
                : "",
          }))
          .filter((person) => person.contactId) ?? [];
      if (people.length > 0) {
        await syncOfferContactsAction({
          companyName: contactInfo?.companyName ?? "",
          people,
        });
      }
      if (!offerId) throw new Error("Save this proposal as an offer before publishing it.");
      const result = await publishOfferChangesAction(offerId, {
        contactInfo,
        assessment: localState.assessment,
        isTestProposal: localState.assessment?.isTestProposal === true,
        pricing: getProposalPricingSnapshotData(localState.assessment as AssessmentState).packagePricing,
      });
      window.localStorage.setItem(`proposal-public-path:${offerId}`, result.publicPath);
      setPublishedVersion(result.version);
      setPublishStatus("published");
    } catch (error) {
      setPublishStatus("error");
      setPublishError(error instanceof Error ? error.message : "Publish failed");
    }
  }

  const saveDone = saveStatus === "saved";
  const publishDone = publishStatus === "published";

  const stepButtonClass = (done: boolean) =>
    done
      ? "inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
      : "ui-action-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <main className="min-h-screen">
      <section className="mx-auto w-full max-w-[1720px] px-5 py-6 lg:px-8">
        <ProposalAppDemoHeader
          currentStep="finalize"
          previousHref="/offers/intro"
          nextHref="/offers/cover"
        />

        <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <section className="proposal-builder-card overflow-hidden rounded-[1.5rem] border border-slate-300 shadow-sm">
              <div className="border-b border-slate-200 bg-white px-5 py-6">
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">1. Save</h2>
                <p className="mt-4 text-sm text-slate-500">
                  Store the current builder state as a draft
                  {offerId ? (
                    <>
                      {" "}for offer <span className="font-mono">{offerId}</span>
                    </>
                  ) : (
                    " (an offer is created on first save)"
                  )}
                  .
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void saveDraft()}
                    disabled={saveStatus === "saving"}
                    className={stepButtonClass(saveDone)}
                  >
                    <Save className="h-4 w-4" />
                    {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : "Save draft"}
                  </button>
                </div>
                {saveStatus === "error" && saveError ? (
                  <p className="mt-3 text-sm text-rose-700">{saveError}</p>
                ) : null}
              </div>
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-6">
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">2. Publish</h2>
                <p className="mt-4 text-sm text-slate-500">
                  Generate the client-facing proposal link.
                  Publishing snapshots the current pricing and agreement text.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void publishOffer()}
                    disabled={!saveDone || publishStatus === "publishing"}
                    title={!offerId ? "Save this proposal as an offer before publishing it." : !saveDone ? "Save the draft first." : undefined}
                    className={stepButtonClass(publishDone)}
                  >
                    <Upload className="h-4 w-4" />
                    {publishStatus === "publishing"
                      ? "Publishing…"
                      : publishStatus === "published"
                        ? `Published${publishedVersion ? ` v${publishedVersion}` : ""}`
                        : "Publish offer"}
                  </button>
                </div>
                {publishStatus === "error" && publishError ? (
                  <p className="mt-3 text-sm text-rose-700">{publishError}</p>
                ) : null}
              </div>
              <div className="bg-white px-5 py-6">
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">3. Send</h2>
                <p className="mt-4 text-sm text-slate-500">
                  Continue to the email step to send the proposal from your connected
                  mailbox, or mark it as sent if you shared the link another way.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {publishDone ? (
                    <Link
                      href={withQuery("/offers/cover", query)}
                      className="ui-action-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
                    >
                      <Send className="h-4 w-4" />
                      Continue to email
                    </Link>
                  ) : (
                    <span
                      title="Publish the offer first."
                      className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-400 opacity-60"
                    >
                      <Send className="h-4 w-4" />
                      Continue to email
                    </span>
                  )}
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  Tip: the eye icon above opens a staff preview in a new tab.
                </p>
              </div>
            </section>
          </div>
          <PricingSnapshotSidebar
            items={getProposalPricingSnapshotItems(assessment)}
            cleanupCard={getProposalPricingSnapshotCleanupCard(assessment)}
            hideLabel
          />
        </div>
      </section>
    </main>
  );
}

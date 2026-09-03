"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Eye, LogOut, Save, Send, Upload } from "lucide-react";
import ProposalAppDemoStepper, { type ProposalAppDemoStep } from "./ProposalAppDemoStepper";
import { readProposalBuilderLocalState } from "./ProposalBuilderStorage";
import {
  getOfferPublicPathAction,
  publishOfferChangesAction,
  saveOfferDraftAction,
  syncOfferContactsAction,
} from "../who/actions";
import type { ContactInfoState } from "./ProposalContactInfoState";
import {
  getProposalPricingSnapshotData,
  type AssessmentState,
} from "./ProposalCreationWorkspaceDemo";

export default function ProposalAppDemoHeader({
  currentStep,
  previousHref,
  nextHref,
  viewProposalAsNext,
}: {
  currentStep: ProposalAppDemoStep;
  previousHref?: string;
  nextHref?: string;
  viewProposalAsNext?: boolean;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const scopedHref = (href: string) => {
    const params = searchParams.toString();
    if (!params || href === "/offers" || href.startsWith("/offers?")) return href;
    return `${href}${href.includes("?") ? "&" : "?"}${params}`;
  };
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [publishStatus, setPublishStatus] = useState<"idle" | "publishing" | "published" | "error">("idle");
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
  const savedSnapshotRef = useRef<string | null>(null);

  const getBuilderSnapshot = () => JSON.stringify(readProposalBuilderLocalState());

  useEffect(() => {
    savedSnapshotRef.current = getBuilderSnapshot();
  }, []);

  useEffect(() => {
    if (saveStatus !== "saved") return;

    const timeoutId = window.setTimeout(() => setSaveStatus("idle"), 2000);
    return () => window.clearTimeout(timeoutId);
  }, [saveStatus]);

  async function saveProposalBuilderState() {
    setSaveStatus("saving");
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
      const offerId = searchParams.get("offer");
      if (offerId) {
        await saveOfferDraftAction(offerId, {
          contactInfo,
          assessment: localState.assessment,
          pricing: getProposalPricingSnapshotData(localState.assessment as AssessmentState).packagePricing,
        });
      }
      setSaveStatus("saved");
      savedSnapshotRef.current = getBuilderSnapshot();
      return true;
    } catch {
      setSaveStatus("error");
      return false;
    }
  }

  async function saveThenNavigate(href: string) {
    if (!(await saveProposalBuilderState())) return;
    router.push(href.startsWith("/offers") && !href.includes("/offers/") ? href : scopedHref(href));
  }

  async function publishProposalChanges() {
    setPublishStatus("publishing");
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
            roleTitle: contactInfo.primaryContact.ownerId === owner.id ? contactInfo.primaryContact.role : "",
          }))
          .filter((person) => person.contactId) ?? [];
      if (people.length > 0) {
        await syncOfferContactsAction({ companyName: contactInfo?.companyName ?? "", people });
      }
      const offerId = searchParams.get("offer");
      if (!offerId) throw new Error("Save this proposal as an offer before publishing it.");

      const result = await publishOfferChangesAction(offerId, {
        contactInfo,
        assessment: localState.assessment,
        pricing: getProposalPricingSnapshotData(localState.assessment as AssessmentState).packagePricing,
      });
      window.localStorage.setItem(`proposal-public-path:${offerId}`, result.publicPath);
      setPublishedVersion(result.version);
      savedSnapshotRef.current = getBuilderSnapshot();
      setPublishStatus("published");
      window.setTimeout(() => setPublishStatus("idle"), 2500);
    } catch {
      setPublishStatus("error");
    }
  }

  function exitToOffers() {
    router.push("/offers?bucket=draft");
  }

  function requestExit() {
    if (savedSnapshotRef.current === getBuilderSnapshot()) {
      exitToOffers();
      return;
    }
    setIsExitDialogOpen(true);
  }

  async function saveAndExit() {
    if (!(await saveProposalBuilderState())) return;
    setIsExitDialogOpen(false);
    exitToOffers();
  }

  async function saveThenOpenProposal() {
    // Open the tab synchronously (before await) so popup blockers don't trigger
    const newTab = window.open("", "_blank");
    const success = await saveProposalBuilderState();
    if (!success || !newTab) {
      newTab?.close();
      return;
    }
    const offerId = searchParams.get("offer");
    const storedPath = offerId ? window.localStorage.getItem(`proposal-public-path:${offerId}`) : null;
    const publicPath = storedPath || (offerId ? await getOfferPublicPathAction(offerId) : null);
    newTab.location.href = publicPath || scopedHref("/proposal/preview");
  }

  return (
    <header className="pb-8 [&_a]:cursor-pointer [&_button:not(:disabled)]:cursor-pointer [&_button:disabled]:cursor-not-allowed">
      <div>
        <div className="flex items-center justify-center gap-2">
        <div className="flex h-11 items-center gap-2">
          <button
            type="button"
            onClick={requestExit}
            disabled={saveStatus === "saving" || publishStatus === "publishing"}
            aria-label="Exit"
            title="Exit"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:text-slate-900 hover:opacity-75 disabled:opacity-40"
          >
            <LogOut className="h-4 w-4 scale-x-[-1]" />
          </button>
          <button
            type="button"
            onClick={() => void saveProposalBuilderState()}
            disabled={saveStatus === "saving" || publishStatus === "publishing"}
            aria-label={saveStatus === "saving" ? "Saving" : saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Save failed" : "Save"}
            title={saveStatus === "saving" ? "Saving" : saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Save failed" : "Save"}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-[0px] font-semibold transition hover:opacity-75 disabled:opacity-40 ${
              saveStatus === "saved"
                ? "text-emerald-700"
                : saveStatus === "error"
                  ? "text-rose-700"
                : "text-slate-500 hover:text-slate-900"
            }`}
            aria-live="polite"
          >
            {saveStatus === "saved" ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Save failed" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => void publishProposalChanges()}
            disabled={saveStatus === "saving" || publishStatus === "publishing"}
            aria-label={publishStatus === "publishing" ? "Publishing" : publishStatus === "published" ? `Published version ${publishedVersion}` : publishStatus === "error" ? "Publish failed" : "Publish"}
            title={publishStatus === "publishing" ? "Publishing" : publishStatus === "published" ? `Published version ${publishedVersion}` : publishStatus === "error" ? "Publish failed" : "Publish"}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-[0px] font-semibold transition hover:opacity-75 disabled:opacity-40 ${
              publishStatus === "published"
                ? "text-emerald-700"
                : publishStatus === "error"
                  ? "text-rose-700"
                  : "text-slate-500 hover:text-slate-900"
            }`}
            aria-live="polite"
          >
            {publishStatus === "published" ? <Check className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
            {publishStatus === "publishing" ? "Publishing…" : publishStatus === "published" ? `Published v${publishedVersion}` : publishStatus === "error" ? "Publish failed" : "Publish"}
          </button>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => void saveThenOpenProposal()}
            disabled={saveStatus === "saving"}
            aria-label="View proposal"
            title="View proposal"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:text-slate-900 hover:opacity-75 disabled:opacity-40"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void saveThenNavigate("/offers/cover")}
            disabled={saveStatus === "saving"}
            aria-label="Email proposal"
            title="Email proposal"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:text-slate-900 hover:opacity-75 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>

        </div>
        <div className="mx-auto flex w-full max-w-[1220px] items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => previousHref && void saveThenNavigate(previousHref)}
            disabled={!previousHref || saveStatus === "saving"}
            className="theme-white hidden shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 xl:inline-flex"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          <div className="min-w-0">
            <ProposalAppDemoStepper currentStep={currentStep} />
          </div>
          {viewProposalAsNext ? (
            <button
              type="button"
              onClick={() => void saveThenOpenProposal()}
              disabled={saveStatus === "saving"}
               className="theme-white hidden shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 xl:inline-flex"
            >
              <Eye className="h-4 w-4" />
              View Proposal
            </button>
          ) : (
            <button
              type="button"
              onClick={() => nextHref && void saveThenNavigate(nextHref)}
              disabled={!nextHref || saveStatus === "saving"}
               className="theme-white hidden shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 xl:inline-flex"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {isExitDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="exit-dialog-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h2 id="exit-dialog-title" className="text-lg font-semibold text-slate-950">Save changes before exiting?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Your changes have not been saved to this offer yet.</p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setIsExitDialogOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">Continue editing</button>
              <button type="button" onClick={() => { setIsExitDialogOpen(false); exitToOffers(); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Exit without saving</button>
              <button type="button" onClick={() => void saveAndExit()} disabled={saveStatus === "saving"} className="ui-action-primary rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-50">{saveStatus === "saving" ? "Saving…" : "Save & exit"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

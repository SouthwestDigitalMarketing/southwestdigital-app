"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Eye, LogOut, Save } from "lucide-react";
import { Modal } from "@/components/Modal";
import ProposalAppDemoStepper, { type ProposalAppDemoStep } from "./ProposalAppDemoStepper";
import {
  PROPOSAL_BUILDER_STATE_CHANGE_EVENT,
  readProposalBuilderLocalState,
} from "./ProposalBuilderStorage";
import {
  getOfferBuilderContextAction,
  saveOfferDraftAction,
  syncOfferContactsAction,
} from "../who/actions";
import {
  formatPersonName,
  resolvePrimaryContact,
  type ContactInfoState,
} from "./ProposalContactInfoState";
import {
  getProposalPricingSnapshotData,
  type AssessmentState,
} from "./ProposalCreationWorkspaceDemo";

export default function ProposalAppDemoHeader({
  currentStep,
}: {
  currentStep: ProposalAppDemoStep;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const offerId = searchParams.get("offer");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
  const [builderContext, setBuilderContext] = useState({
    offerCode: offerId ?? "",
    contactName: "",
  });
  useEffect(() => {
    let disposed = false;

    function localPrimaryContactName() {
      const contactInfo = readProposalBuilderLocalState().contactInfo as ContactInfoState | undefined;
      if (!contactInfo?.primaryContact || !Array.isArray(contactInfo.owners)) return "";
      const primary = resolvePrimaryContact(contactInfo);
      return formatPersonName(primary.firstName, primary.lastName);
    }

    function syncLocalContactName() {
      const contactName = localPrimaryContactName();
      setBuilderContext((current) => ({
        ...current,
        contactName,
      }));
    }

    // Hydrate the label from the builder's external localStorage state, then
    // keep it current through the subscription below.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBuilderContext({
      offerCode: offerId ?? "",
      contactName: localPrimaryContactName(),
    });
    window.addEventListener(PROPOSAL_BUILDER_STATE_CHANGE_EVENT, syncLocalContactName);
    window.addEventListener("storage", syncLocalContactName);

    if (offerId) {
      void getOfferBuilderContextAction(offerId).then((context) => {
        if (disposed || !context) return;
        setBuilderContext((current) => ({
          offerCode: context.offerCode,
          contactName: localPrimaryContactName() || current.contactName || context.contactName,
        }));
      }).catch(() => {});
    }

    return () => {
      disposed = true;
      window.removeEventListener(PROPOSAL_BUILDER_STATE_CHANGE_EVENT, syncLocalContactName);
      window.removeEventListener("storage", syncLocalContactName);
    };
  }, [offerId]);

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
          isTestProposal: localState.assessment?.isTestProposal === true,
          pricing: getProposalPricingSnapshotData(localState.assessment as AssessmentState).packagePricing,
        });
      }
      setSaveStatus("saved");
      return true;
    } catch {
      setSaveStatus("error");
      return false;
    }
  }

  function exitToOffers() {
    router.push("/offers?bucket=draft");
  }

  function requestExit() {
    setIsExitDialogOpen(true);
  }

  async function saveAndExit() {
    if (!(await saveProposalBuilderState())) return;
    setIsExitDialogOpen(false);
    exitToOffers();
  }

  function openFullscreenProposalPreview() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("preview", "fullscreen");

    // Fullscreen must be requested directly from the user's click. Keeping the
    // document fullscreen across the client-side route change lets the Preview
    // step replace it with the proposal-only surface without opening a new tab.
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch(() => {});
    }

    router.push(`/offers/intro?${params.toString()}`);
  }

  return (
    <header className="proposal-builder-header pb-4 [&_a]:cursor-pointer [&_button:not(:disabled)]:cursor-pointer [&_button:disabled]:cursor-not-allowed">
      <div>
        <p
          className="mb-1 text-center text-sm font-semibold text-slate-600"
          title={builderContext.offerCode || undefined}
        >
          <span className="font-mono text-slate-800">
            {builderContext.offerCode ? `*${builderContext.offerCode.slice(-4)}` : "New offer"}
          </span>{" "}
          for {builderContext.contactName || "Primary contact not set"}
        </p>
        <div className="flex items-center justify-center gap-2">
        <div className="flex h-11 items-center gap-2">
          <button
            type="button"
            onClick={openFullscreenProposalPreview}
            disabled={saveStatus === "saving"}
            aria-label="Preview proposal"
            title="Preview proposal"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:text-slate-900 hover:opacity-75 disabled:opacity-40"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void saveProposalBuilderState()}
            disabled={saveStatus === "saving"}
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
            onClick={requestExit}
            disabled={saveStatus === "saving"}
            aria-label="Exit"
            title="Exit"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:text-slate-900 hover:opacity-75 disabled:opacity-40"
          >
            <LogOut className="h-4 w-4 scale-x-[-1]" />
          </button>
        </div>
        </div>
        <div className="mx-auto w-full max-w-[1220px]">
          <div className="min-w-0">
            <ProposalAppDemoStepper currentStep={currentStep} />
          </div>
        </div>
      </div>
      {isExitDialogOpen ? (
        <Modal onClose={() => setIsExitDialogOpen(false)} labelledBy="exit-dialog-title" className="!w-fit max-w-[calc(100vw-2rem)]" busy={saveStatus === "saving"}>
          <div className="p-5 sm:p-6">
            <h2 id="exit-dialog-title" className="text-xl font-semibold text-slate-950">Save before exiting?</h2>
            <div className="mt-6 flex flex-nowrap items-stretch justify-end gap-2">
              <button type="button" onClick={() => setIsExitDialogOpen(false)} className="whitespace-nowrap rounded-lg px-3 py-2 text-base font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">Continue editing</button>
              <button type="button" onClick={() => { setIsExitDialogOpen(false); exitToOffers(); }} className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-base font-semibold text-slate-700 transition hover:bg-slate-50">Exit without saving</button>
              <button type="button" onClick={() => void saveAndExit()} disabled={saveStatus === "saving"} className="ui-action-primary whitespace-nowrap rounded-lg px-3 py-2 text-base font-semibold transition disabled:opacity-50">{saveStatus === "saving" ? "Saving…" : "Save & exit"}</button>
            </div>
          </div>
        </Modal>
      ) : null}
    </header>
  );
}

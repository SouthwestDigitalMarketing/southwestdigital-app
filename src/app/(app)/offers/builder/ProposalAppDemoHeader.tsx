"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Eye, LogOut, Save, Send } from "lucide-react";
import ProposalAppDemoStepper, { type ProposalAppDemoStep } from "./ProposalAppDemoStepper";
import { readProposalBuilderLocalState } from "./ProposalBuilderStorage";
import { saveOfferDraftAction, syncOfferContactsAction } from "../who/actions";
import type { ContactInfoState } from "./ProposalContactInfoState";

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
        });
      }
      setSaveStatus("saved");
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

  async function saveThenOpenProposal() {
    if (!(await saveProposalBuilderState())) return;
    window.open(scopedHref("/offers/preview"), "_blank", "noopener,noreferrer");
  }

  return (
    <header className="pb-8 [&_a]:cursor-pointer [&_button:not(:disabled)]:cursor-pointer [&_button:disabled]:cursor-not-allowed">
      <div>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <div className="flex h-11 items-center gap-6">
          <button
            type="button"
            onClick={() => void saveThenNavigate("/offers?bucket=draft")}
            disabled={saveStatus === "saving"}
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-slate-500 transition hover:text-slate-900 hover:opacity-75 disabled:opacity-40"
          >
            <LogOut className="h-4 w-4 scale-x-[-1]" />
            Save &amp; Exit
          </button>
          <button
            type="button"
            onClick={() => void saveProposalBuilderState()}
            disabled={saveStatus === "saving"}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold transition hover:opacity-75 disabled:opacity-40 ${
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
        </div>

        <div className="flex w-full max-w-[1220px] items-center gap-6">
          <button
            type="button"
            onClick={() => previousHref && void saveThenNavigate(scopedHref(previousHref))}
            disabled={!previousHref || saveStatus === "saving"}
            className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 xl:inline-flex"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          <div className="min-w-0 flex-1">
            <ProposalAppDemoStepper currentStep={currentStep} />
          </div>
          {viewProposalAsNext ? (
            <button
              type="button"
              onClick={() => void saveThenNavigate(scopedHref("/offers/preview"))}
              disabled={saveStatus === "saving"}
              className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 xl:inline-flex"
            >
              <Eye className="h-4 w-4" />
              View Proposal
            </button>
          ) : (
            <button
              type="button"
              onClick={() => nextHref && void saveThenNavigate(scopedHref(nextHref))}
              disabled={!nextHref || saveStatus === "saving"}
              className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 xl:inline-flex"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-end gap-6">
          <button
            type="button"
            onClick={() => void saveThenNavigate(scopedHref("/offers/cover"))}
            disabled={saveStatus === "saving"}
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-slate-500 transition hover:text-slate-900 hover:opacity-75 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
            Email
          </button>
          <button
            type="button"
            onClick={() => void saveThenOpenProposal()}
            disabled={saveStatus === "saving"}
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-slate-500 transition hover:text-slate-900 hover:opacity-75 disabled:opacity-40"
          >
            <Eye className="h-4 w-4" />
            View Proposal
          </button>
        </div>
        </div>
      </div>
    </header>
  );
}

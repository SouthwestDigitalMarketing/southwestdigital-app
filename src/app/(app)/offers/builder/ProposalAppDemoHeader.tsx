"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, LogOut, Save } from "lucide-react";
import ProposalAppDemoStepper, { type ProposalAppDemoStep } from "./ProposalAppDemoStepper";
import ProposalAppExpandAllControl from "./ProposalAppExpandAllControl";
import { readProposalBuilderLocalState } from "./ProposalBuilderStorage";
import { saveOfferDraftAction, syncOfferContactsAction } from "../who/actions";
import type { ContactInfoState } from "./ProposalContactInfoState";

export default function ProposalAppDemoHeader({
  currentStep,
  previousHref,
  nextHref,
  onExpandAll,
  onCollapseAll,
}: {
  currentStep: ProposalAppDemoStep;
  previousHref?: string;
  nextHref?: string;
  onExpandAll: () => void;
  onCollapseAll: () => void;
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
      <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
        <div className="flex h-11 items-center gap-3">
          <button
            type="button"
            onClick={() => void saveThenNavigate("/offers?bucket=draft")}
            disabled={saveStatus === "saving"}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-900"
          >
            <LogOut className="h-4 w-4 scale-x-[-1]" />
            Save &amp; Exit
          </button>
          <button
            type="button"
            onClick={() => void saveProposalBuilderState()}
            disabled={saveStatus === "saving"}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-semibold transition ${
              saveStatus === "saved"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : saveStatus === "error"
                  ? "border-rose-300 bg-rose-50 text-rose-700"
                : "border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-900"
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
          <span className="text-slate-300">|</span>
          <ProposalAppExpandAllControl
            onExpandAll={onExpandAll}
            onCollapseAll={onCollapseAll}
          />
        </div>

        <div className="relative w-full max-w-[1220px]">
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={() => previousHref && void saveThenNavigate(scopedHref(previousHref))}
              disabled={!previousHref || saveStatus === "saving"}
              aria-label="Previous proposal step"
              className="hidden h-7 w-7 shrink-0 place-items-center rounded-full border border-slate-300 bg-white text-slate-600 transition hover:border-slate-400 hover:text-slate-950 disabled:cursor-default disabled:opacity-30 xl:grid"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <ProposalAppDemoStepper currentStep={currentStep} />
            </div>
            <button
              type="button"
              onClick={() => nextHref && void saveThenNavigate(scopedHref(nextHref))}
              disabled={!nextHref || saveStatus === "saving"}
              aria-label="Next proposal step"
              className="hidden h-7 w-7 shrink-0 place-items-center rounded-full border border-slate-300 bg-white text-slate-600 transition hover:border-slate-400 hover:text-slate-950 disabled:cursor-default disabled:opacity-30 xl:grid"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="absolute left-1/2 top-full flex -translate-x-1/2 items-center gap-2 xl:hidden">
            <button
              type="button"
              onClick={() => previousHref && void saveThenNavigate(scopedHref(previousHref))}
              disabled={!previousHref || saveStatus === "saving"}
              aria-label="Previous proposal step"
              className="grid h-7 w-7 place-items-center rounded-full border border-slate-300 bg-white text-slate-600 transition hover:border-slate-400 hover:text-slate-950 disabled:cursor-default disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => nextHref && void saveThenNavigate(scopedHref(nextHref))}
              disabled={!nextHref || saveStatus === "saving"}
              aria-label="Next proposal step"
              className="grid h-7 w-7 place-items-center rounded-full border border-slate-300 bg-white text-slate-600 transition hover:border-slate-400 hover:text-slate-950 disabled:cursor-default disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => void saveThenNavigate(scopedHref("/offers/cover"))}
            disabled={saveStatus === "saving"}
            className="inline-flex h-11 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => void saveThenOpenProposal()}
            disabled={saveStatus === "saving"}
            className="inline-flex h-11 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            View Proposal
          </button>
        </div>
      </div>
    </header>
  );
}

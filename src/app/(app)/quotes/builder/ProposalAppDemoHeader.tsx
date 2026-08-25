"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, LogOut, Save } from "lucide-react";
import ProposalAppDemoStepper, { type ProposalAppDemoStep } from "./ProposalAppDemoStepper";
import ProposalAppExpandAllControl from "./ProposalAppExpandAllControl";

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
    if (!params || href === "/quotes") return href;
    return `${href}${href.includes("?") ? "&" : "?"}${params}`;
  };
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (saveStatus !== "saved") return;

    const timeoutId = window.setTimeout(() => setSaveStatus("idle"), 2000);
    return () => window.clearTimeout(timeoutId);
  }, [saveStatus]);

  function saveProposalBuilderState() {
    setSaveStatus("saved");
    return true;
  }

  function saveThenNavigate(href: string) {
    if (!saveProposalBuilderState()) return;
    router.push(href === "/quotes" ? href : scopedHref(href));
  }

  return (
    <header className="pb-8 [&_a]:cursor-pointer [&_button:not(:disabled)]:cursor-pointer [&_button:disabled]:cursor-not-allowed">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
        <div className="flex h-11 items-center gap-3">
          <button
            type="button"
            onClick={() => void saveThenNavigate("/quotes")}
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

        <div className="hidden items-center justify-end gap-3 lg:flex" />
      </div>
    </header>
  );
}

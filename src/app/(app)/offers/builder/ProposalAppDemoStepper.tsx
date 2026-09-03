"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment } from "react";

export type ProposalAppDemoStep =
  | "contact"
  | "scale"
  | "complexity"
  | "included"
  | "pricing"
  | "add-ons"
  | "intro"
  | "cover"
  | "preview";

const STEP_ITEMS: Array<{
  id: ProposalAppDemoStep;
  label: string;
  href?: string;
}> = [
  { id: "contact", label: "Contact", href: "/offers/new" },
  {
    id: "scale",
    label: "Scale",
    href: "/offers/scale",
  },
  {
    id: "complexity",
    label: "Complexity",
    href: "/offers/pricing",
  },
  {
    id: "pricing",
    label: "Adjustments",
    href: "/offers/calculator",
  },
  {
    id: "add-ons",
    label: "Options",
    href: "/offers/add-ons",
  },
  {
    id: "intro",
    label: "Preview",
    href: "/offers/intro",
  },
];

export default function ProposalAppDemoStepper({
  currentStep,
}: {
  currentStep: ProposalAppDemoStep;
}) {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const activeIndex = STEP_ITEMS.findIndex((step) => step.id === currentStep);

  return (
    <div className="flex items-center justify-center">
      {STEP_ITEMS.map((step, index) => {
        const state =
          index === activeIndex ? "active" : index < activeIndex ? "complete" : "inactive";

        return (
          <Fragment key={step.id}>
            <StepPill
              label={step.label}
              state={state}
              href={query ? `${step.href}?${query}` : step.href}
            />
            {index < STEP_ITEMS.length - 1 ? (
              <span className="mx-1 h-px min-w-2 flex-1 bg-slate-200" />
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}

function StepPill({
  label,
  state,
  href,
}: {
  label: string;
  state: "complete" | "active" | "inactive";
  href?: string;
}) {
  const pillClass =
    state === "active"
      ? "proposal-step-active border shadow-sm"
      : "border-slate-300 bg-white text-slate-400";
  const content = (
    <span
      className={`relative z-10 inline-flex h-7 items-center justify-center whitespace-nowrap rounded-full border px-3 text-xs font-semibold transition ${pillClass} ${
        href ? "cursor-pointer hover:opacity-80" : ""
      }`}
    >
      {label}
    </span>
  );

  return (
    <div className="flex shrink-0 items-center justify-center">
      {href ? <Link href={href}>{content}</Link> : content}
    </div>
  );
}

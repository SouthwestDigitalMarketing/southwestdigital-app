"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useCallback } from "react";
import { useKeyboardAction, useKeyboardScope } from "@/components/keyboard/KeyboardProvider";
import { BUILDER_STEPS } from "@/lib/keyboard/commands";

export type ProposalAppDemoStep =
  | "contact"
  | "scale"
  | "complexity"
  | "add-ons"
  | "adjustments"
  | "intro"
  | "finalize"
  | "cover";

/**
 * The route behind each `currentStep` value.
 *
 * BUILDER_STEPS (src/lib/keyboard/commands.ts) owns the flow order, the labels
 * and the digit shortcuts; this array only ties those routes back to the short
 * ids the `currentStep` prop uses, which the keymap has no reason to know
 * about. A drift guard test asserts every BUILDER_STEPS href appears here.
 */
const STEP_ROUTES: Array<{ id: ProposalAppDemoStep; href: string }> = [
  { id: "contact", href: "/offers/contact" },
  { id: "scale", href: "/offers/scale" },
  { id: "complexity", href: "/offers/complexity" },
  { id: "add-ons", href: "/offers/add-ons" },
  { id: "adjustments", href: "/offers/adjustments" },
  { id: "intro", href: "/offers/intro" },
  { id: "finalize", href: "/offers/finalize" },
  { id: "cover", href: "/offers/cover" },
];

const STEP_ITEMS: Array<{
  id: ProposalAppDemoStep;
  label: string;
  href: string;
  digit: string;
}> = BUILDER_STEPS.map((step) => {
  const route = STEP_ROUTES.find((candidate) => candidate.href === step.href);
  if (!route) {
    throw new Error(
      `Builder step ${step.id} points at ${step.href}, which the stepper does not define.`,
    );
  }
  return { id: route.id, label: step.title, href: step.href, digit: step.digit };
});

export default function ProposalAppDemoStepper({
  currentStep,
}: {
  currentStep: ProposalAppDemoStep;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const activeIndex = STEP_ITEMS.findIndex((step) => step.id === currentStep);

  // Activate the builder commands; all paths preserve the current offer query.
  useKeyboardScope("builder");

  // The query string carries ?offer=, so dropping it would silently move the
  // user onto a different draft.
  const hrefFor = useCallback(
    (href: string) => (query ? `${href}?${query}` : href),
    [query],
  );

  const goToStep = useCallback(
    (index: number) => {
      const step = STEP_ITEMS[index];
      if (!step) return;
      router.push(hrefFor(step.href));
    },
    [hrefFor, router],
  );

  useKeyboardAction("builder.step.contact", () => goToStep(0));
  useKeyboardAction("builder.step.scale", () => goToStep(1));
  useKeyboardAction("builder.step.complexity", () => goToStep(2));
  useKeyboardAction("builder.step.services", () => goToStep(3));
  useKeyboardAction("builder.step.adjustments", () => goToStep(4));
  useKeyboardAction("builder.step.style", () => goToStep(5));
  useKeyboardAction("builder.step.publish", () => goToStep(6));
  useKeyboardAction("builder.step.email", () => goToStep(7));

  useKeyboardAction("builder.previousStep", () => goToStep(activeIndex - 1));
  useKeyboardAction("builder.nextStep", () => goToStep(activeIndex + 1));

  return (
    <nav aria-label="Offer builder steps">
      <ol className="flex items-center justify-center px-1">
        {STEP_ITEMS.map((step, index) => {
          const state =
            index === activeIndex ? "active" : index < activeIndex ? "complete" : "inactive";

          return (
            <Fragment key={step.id}>
              <li className="flex shrink-0 items-center justify-center">
                <StepPill
                  label={step.label}
                  position={index + 1}
                  total={STEP_ITEMS.length}
                  digit={step.digit}
                  state={state}
                  href={hrefFor(step.href)}
                />
              </li>
              {index < STEP_ITEMS.length - 1 ? (
                <li aria-hidden="true" className="mx-1 h-px min-w-2 flex-1 bg-slate-200" />
              ) : null}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

function StepPill({
  label,
  position,
  total,
  digit,
  state,
  href,
}: {
  label: string;
  position: number;
  total: number;
  digit: string;
  state: "complete" | "active" | "inactive";
  href: string;
}) {
  const pillClass =
    state === "active"
      ? "proposal-step-active border shadow-sm"
      : "border-slate-300 bg-white text-slate-400";

  return (
    <Link
      href={href}
      aria-label={`Step ${position} of ${total}: ${label}`}
      aria-current={state === "active" ? "step" : undefined}
      aria-keyshortcuts={digit}
      title={`${label} — press ${digit}`}
      className={`ui-focus-ring relative z-10 inline-flex h-7 cursor-pointer items-center justify-center whitespace-nowrap rounded-full border px-3 text-xs font-semibold transition hover:opacity-80 ${pillClass}`}
    >
      {label}
      {/* Only on displays wide enough that eight extra glyphs cannot push the
          header into horizontal overflow; the title carries it everywhere. */}
      <span aria-hidden="true" className="ml-1 hidden text-[10px] font-normal opacity-60 2xl:inline">
        {digit}
      </span>
    </Link>
  );
}

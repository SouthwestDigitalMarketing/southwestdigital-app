import Link from "next/link";
import { Check } from "lucide-react";

export type StepState = "done" | "current" | "yours" | "todo" | "skipped";

export type Step = {
  label: string;
  state: StepState;
  note: string;
  href?: string;
};

const DOT: Record<StepState, string> = {
  done: "border-slate-900 bg-slate-900 text-white",
  current: "border-slate-900 bg-white text-slate-900",
  yours: "border-amber-500 bg-amber-500 text-white",
  todo: "border-slate-300 bg-white text-slate-400",
  skipped: "border-slate-300 bg-slate-100 text-slate-400",
};

/**
 * Sort, Choose, Do (Tom, 2026-11-26): where an Inbox job stands and whose turn it
 * is. Finished steps link to what they did.
 */
export function Stepper({ steps }: { steps: Step[] }) {
  return (
    <ol aria-label="Job steps" className="flex items-start">
      {steps.map((step, i) => {
        const body = (
          <>
            <span className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${DOT[step.state]}`}
                aria-hidden="true"
              >
                {step.state === "done" ? <Check size={14} /> : i + 1}
              </span>
              <span
                className={`text-sm font-semibold ${step.state === "todo" || step.state === "skipped" ? "text-slate-400" : "text-slate-900"}`}
              >
                {step.label}
              </span>
            </span>
            <span
              className={`mt-0.5 block pl-8 text-xs ${step.state === "yours" ? "font-medium text-amber-700" : "text-slate-500"}`}
            >
              {step.note}
            </span>
          </>
        );
        return (
          <li
            key={step.label}
            aria-current={
              step.state === "current" || step.state === "yours"
                ? "step"
                : undefined
            }
            className="flex min-w-0 flex-1 items-start gap-2"
          >
            {step.href ? (
              <Link href={step.href} className="min-w-0 hover:opacity-80">
                {body}
              </Link>
            ) : (
              <span className="min-w-0">{body}</span>
            )}
            {i < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className={`mx-2 mt-3 h-0.5 flex-1 ${step.state === "done" ? "bg-slate-900" : "bg-slate-200"}`}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

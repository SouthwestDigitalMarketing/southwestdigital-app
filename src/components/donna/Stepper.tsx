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
    <ol aria-label="Job steps" className="donna-ui flex items-start">
      {steps.map((step, i) => {
        const body = (
          <>
            <span className="flex items-center gap-2">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-semibold sm:h-6 sm:w-6 sm:text-xs ${DOT[step.state]}`}
                aria-hidden="true"
              >
                {step.state === "done" ? <Check size={14} /> : i + 1}
              </span>
              <span
                className={`whitespace-nowrap text-xs font-semibold sm:text-sm ${step.state === "todo" || step.state === "skipped" ? "text-slate-400" : "text-slate-900"}`}
              >
                {step.label}
              </span>
            </span>
            <span
              title={step.note}
              className={`mt-0.5 block max-w-[6.5rem] truncate pl-6 text-[11px] sm:max-w-none sm:whitespace-normal sm:pl-8 sm:text-xs ${step.state === "yours" ? "font-medium text-amber-700" : "text-slate-500"}`}
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
                className={`mx-1 mt-2.5 h-0.5 min-w-2 flex-1 sm:mx-2 sm:mt-3 ${step.state === "done" ? "bg-slate-900" : "bg-slate-200"}`}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

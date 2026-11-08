export const LEAD_STEPS = ["reach", "qb", "book", "call", "quote", "payment", "agreement", "session", "nurture"] as const;
export type LeadStep = (typeof LEAD_STEPS)[number];

export const LEAD_STEP_STAGE: Record<LeadStep, "lead" | "talking" | "proposed"> = {
  reach: "lead",
  qb: "talking",
  book: "talking",
  call: "talking",
  quote: "proposed",
  payment: "proposed",
  agreement: "proposed",
  session: "talking",
  nurture: "proposed",
};

export const LEAD_STEP_LABEL: Record<LeadStep, string> = {
  reach: "Contact lead and request QBO invite",
  qb: "Review QBO",
  book: "Book review call",
  call: "Conduct review call",
  quote: "Send Quote & Contract",
  payment: "Collect initial payment",
  agreement: "Get service agreements signed",
  session: "Collect payment / book session",
  nurture: "Nurture",
};

export const LEAD_STEP_FALLBACK_BY_STAGE: Partial<Record<string, LeadStep>> = {
  lead: "reach",
  talking: "qb",
  proposed: "quote",
};

export function pipeLeadBoardColumnId(stageId: string, stageKey: string, leadStep: string | null): string {
  if (leadStep && LEAD_STEPS.includes(leadStep as LeadStep) && LEAD_STEP_STAGE[leadStep as LeadStep] === stageKey) {
    return `lead-step-${leadStep}`;
  }
  const fallback = LEAD_STEP_FALLBACK_BY_STAGE[stageKey];
  return fallback ? `lead-step-${fallback}` : stageId;
}

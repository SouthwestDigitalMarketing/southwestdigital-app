export const PRIVATE_FEEDBACK_REASONS = [
  { id: "communication", label: "Poor communication" },
  { id: "turnaround", label: "Slow turnaround time" },
  { id: "pricing", label: "Pricing concerns" },
  { id: "quality", label: "Quality of work concerns" },
  { id: "other", label: "Something else" },
] as const;

export type PrivateFeedbackReasonId = (typeof PRIVATE_FEEDBACK_REASONS)[number]["id"];

export const OTHER_FEEDBACK_REASON_ID = "other" satisfies PrivateFeedbackReasonId;

export function formatPrivateFeedbackText(
  reasonIds: string[],
  extra: string,
): string | null {
  const labels: string[] = [];
  for (const id of reasonIds) {
    const label = PRIVATE_FEEDBACK_REASONS.find((item) => item.id === id)?.label;
    if (label) labels.push(label);
  }
  const detail = extra.trim();
  if (labels.length === 0) return detail || null;
  const reasonText = labels.join(", ");
  return detail ? `${reasonText}: ${detail}` : reasonText;
}

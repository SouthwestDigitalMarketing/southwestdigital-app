export const PRIVATE_FEEDBACK_REASONS = [
  { id: "communication", label: "Communication" },
  { id: "turnaround", label: "Turnaround time" },
  { id: "pricing", label: "Pricing" },
  { id: "quality", label: "Quality of work" },
  { id: "other", label: "Something else" },
] as const;

export type PrivateFeedbackReasonId = (typeof PRIVATE_FEEDBACK_REASONS)[number]["id"];

export const OTHER_FEEDBACK_REASON_ID = "other" satisfies PrivateFeedbackReasonId;

export function formatPrivateFeedbackText(
  reasonId: string,
  extra: string,
): string | null {
  const reason = PRIVATE_FEEDBACK_REASONS.find((item) => item.id === reasonId);
  if (!reason) return extra.trim() || null;
  const detail = extra.trim();
  if (reason.id === OTHER_FEEDBACK_REASON_ID) return detail || reason.label;
  if (!detail) return reason.label;
  return `${reason.label}: ${detail}`;
}

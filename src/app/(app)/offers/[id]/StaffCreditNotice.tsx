// Spec 06 staff remainder notice: "Credit to apply on next invoice: $X —
// <reason>" so whoever sends the next invoice applies the remainder frozen
// at acceptance (falling back to the stored checkout). Staff-only; renders
// nothing when no remainder above zero exists.
import { staffCreditLine } from "@/lib/quotes/serviceStartDisplay";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export default function StaffCreditNotice({ onboardingData }: { onboardingData: unknown }) {
  const data = isRecord(onboardingData) ? onboardingData : {};
  const acceptance = isRecord(data.proposalAcceptance) ? data.proposalAcceptance : {};
  const acceptedSelection = isRecord(acceptance.selection) ? acceptance.selection : {};
  const services = isRecord(data.proposalBuilderState) && isRecord(data.proposalBuilderState.services)
    ? data.proposalBuilderState.services
    : {};
  const firstNumber = (...values: unknown[]): unknown =>
    values.find((value): value is number => typeof value === "number");
  const firstString = (...values: unknown[]): unknown =>
    values.find((value): value is string => typeof value === "string");
  const line = staffCreditLine(
    firstNumber(acceptance.creditRemaining, acceptedSelection.creditRemaining, services.creditRemaining),
    firstString(acceptance.creditRemainingReason, acceptedSelection.creditRemainingReason, services.creditRemainingReason),
  );
  if (!line) return null;
  return (
    <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
      {line}
    </div>
  );
}

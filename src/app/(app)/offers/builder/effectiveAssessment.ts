import {
  normalizeAccountInventory,
  resolveTransactionBand,
  summarizeAccountInventory,
} from "@/lib/quotes/accountInventory";
import type { AssessmentState } from "./ProposalCreationWorkspaceDemo";

/** Preserve legacy pricing inputs unless at least one open account is listed. */
export function effectiveAssessment(assessment: AssessmentState): AssessmentState {
  const summary = summarizeAccountInventory(normalizeAccountInventory(assessment.accounts));
  if (!summary.hasInventory) return assessment;
  // The inventory is the TOTAL of open accounts, so legacy unconnected counts
  // are the unconnected slice of that total — not extra accounts on top.
  const unconnectedBankAccountsCount = clampUnconnectedCount(
    assessment.unconnectedBankAccountsCount,
    summary.derivedCounts.bankAccountsCount,
  );
  const unconnectedCreditCardsCount = clampUnconnectedCount(
    assessment.unconnectedCreditCardsCount,
    summary.derivedCounts.creditCardsCount,
  );
  const unconnectedLinesOfCreditCount = clampUnconnectedCount(
    assessment.unconnectedLinesOfCreditCount,
    summary.derivedCounts.linesOfCreditCount,
  );
  return {
    ...assessment,
    bankAccountsCount: connectedCount(summary.derivedCounts.bankAccountsCount, unconnectedBankAccountsCount),
    creditCardsCount: connectedCount(summary.derivedCounts.creditCardsCount, unconnectedCreditCardsCount),
    unconnectedBankAccountsCount,
    unconnectedCreditCardsCount,
    loansCount: summary.derivedCounts.loansCount,
    linesOfCreditCount: connectedCount(summary.derivedCounts.linesOfCreditCount, unconnectedLinesOfCreditCount),
    unconnectedLinesOfCreditCount,
    vehicleNotesCount: summary.derivedCounts.vehicleNotesCount,
    transactionBand: resolveTransactionBand(assessment).band as AssessmentState["transactionBand"],
  };
}

/** Clamp a legacy unconnected count to the inventoried total for its kind. */
function clampUnconnectedCount(value: number | "", inventoryCount: number): number | "" {
  if (value === "") return "";
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.trunc(value), 0), inventoryCount);
}

/** Connected accounts are the inventoried total minus the unconnected slice. */
function connectedCount(inventoryCount: number, unconnected: number | ""): number {
  return Math.max(0, inventoryCount - (typeof unconnected === "number" ? unconnected : 0));
}

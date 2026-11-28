// Spec 04 shared proposal-terms rendering for a wrap-up plan: the wrap-up
// line, the fixed monthly-start rule, the cleanup payment plan line with its
// installment list, and the extension clause. One source for the builder
// preview (ProposalPaymentPlan), the public proposal, and the receipt page —
// all three assert the same contract text builders, so they cannot drift.
//
// Unstyled on purpose: parents own color and size (preview and receipt set
// their own), this block only contributes structure.

import {
  cleanupExtensionClauseText,
  cleanupPaymentPlanText,
  cleanupWrapUpLengthText,
  cleanupWrapUpText,
  monthlyStartLengthText,
  monthlyStartText,
  type CleanupInstallment,
  type CleanupPlan,
} from "@/lib/quotes/cleanupPlan";

const fmt = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function formatCleanupInstallmentAmount(amountCents: number): string {
  return fmt(amountCents / 100);
}

export default function CleanupTermsBlock({
  plan,
  installments,
  monthlyRate,
  brandName = "us",
  annual = false,
  showExtension = true,
  isEstimate = false,
  dateWording = "exact",
  mentionFileFee,
}: {
  plan: CleanupPlan;
  installments: CleanupInstallment[];
  monthlyRate: number;
  brandName?: string;
  annual?: boolean;
  showExtension?: boolean;
  /**
   * Whether the agreement carrying this clause charges the $150
   * file-maintenance fee. When false the extension clause uses generic
   * wording so it never names a fee the agreement does not charge.
   * Undefined (default) names the fee, matching the default template.
   */
  mentionFileFee?: boolean;
  /**
   * Pre-selection public terms preview the full cleanup scope before the
   * client selects periods. Labelled so an estimate never reads as agreed
   * terms; post-selection the frozen checkout renders without it.
   */
  isEstimate?: boolean;
  /**
   * Pre-selection surfaces show the cleanup length instead of the wrap-up
   * calendar date, which would go stale before the client selects.
   * Post-selection (agreement, receipt) keeps "exact" with the stored
   * checkout dates. Defaults to "exact" so existing callers render as today.
   */
  dateWording?: "exact" | "length";
}) {
  const length = dateWording === "length";
  return (
    <div className="space-y-2">
      {isEstimate ? <p><em>Estimate — based on the full cleanup scope. Your selected periods set the final price.</em></p> : null}
      <p>{length ? cleanupWrapUpLengthText(plan) : cleanupWrapUpText(plan)}</p>
      <p>{length ? monthlyStartLengthText({ hasCleanup: true, plan, prepaidAnnual: annual }) : monthlyStartText({ hasCleanup: true, plan, prepaidAnnual: annual })}</p>
      <p>{cleanupPaymentPlanText(plan, installments)}</p>
      {installments.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5">
          {installments.map((installment) => (
            <li key={installment.label}>
              {installment.label}: <strong>{formatCleanupInstallmentAmount(installment.amountCents)}</strong>
            </li>
          ))}
        </ul>
      ) : null}
      {showExtension ? <p>{cleanupExtensionClauseText({ monthlyRate, brandName, mentionFileFee })}</p> : null}
    </div>
  );
}

// Spec 04: which wrap-up plan (and whose installments) the proposal preview
// hands to ProposalPaymentPlan. Pure so the priority rule is unit-testable
// without rendering the whole preview:
//
// 1. The stored checkout plan wins post-selection (exact frozen installments).
// 2. Otherwise the staff snapshot plan (builder preview), normalized.
// 3. Otherwise the whitelisted public plan (public proposal); its start date
//    is a placeholder because the texts and the installment preview never
//    read it and installments are never recomputed from it here.
// 4. Without cleanup, or without any plan, null — the payment plan then
//    renders exactly as today (legacy).

import {
  buildCleanupInstallments,
  normalizeCleanupPlan,
  type CleanupInstallment,
  type CleanupPlan,
} from "@/lib/quotes/cleanupPlan";
import type { PublicCleanupPlan } from "@/lib/quotes/publicProposal";

export type PreviewCleanupDisplay = {
  plan: CleanupPlan | null;
  installments: CleanupInstallment[];
  /**
   * True only for the pre-selection public preview: the whitelisted plan
   * covers the full cleanup scope and the client has not selected periods
   * yet, so the terms render labelled as an estimate. Frozen post-selection
   * checkouts and staff builder previews never set it.
   */
  isEstimate: boolean;
};

export function resolvePreviewCleanupDisplay(input: {
  hasCleanup: boolean;
  livePublic: boolean;
  staffCleanupPlan: unknown;
  publicCleanupPlan?: PublicCleanupPlan | null;
  checkoutCleanupPlan?: CleanupPlan | null;
  checkoutInstallments?: CleanupInstallment[] | null;
  selectedCleanupMonths: number;
  selectedCleanupTotal: number;
}): PreviewCleanupDisplay {
  if (!input.hasCleanup) return { plan: null, installments: [], isEstimate: false };
  const normalizedStaffPlan =
    !input.livePublic && input.staffCleanupPlan && typeof input.staffCleanupPlan === "object"
      ? normalizeCleanupPlan(input.staffCleanupPlan, { backlogMonths: input.selectedCleanupMonths })
      : null;
  const publicPlan = input.livePublic ? input.publicCleanupPlan ?? null : null;
  const plan: CleanupPlan | null =
    input.checkoutCleanupPlan
    ?? normalizedStaffPlan
    ?? (publicPlan
      ? {
          caughtUpThrough: publicPlan.caughtUpThrough,
          startDate: publicPlan.wrapUpDate,
          wrapUpDate: publicPlan.wrapUpDate,
          wrapUpSource: "default" as const,
          paymentPlan: publicPlan.paymentPlan,
        }
      : null);
  if (!plan) return { plan: null, installments: [], isEstimate: false };
  const fromPublicPlan = input.livePublic && !input.checkoutCleanupPlan && !normalizedStaffPlan && publicPlan !== null;
  const installments =
    input.checkoutInstallments
    ?? (normalizedStaffPlan
      ? buildCleanupInstallments(Math.round(input.selectedCleanupTotal * 100), normalizedStaffPlan)
      : (publicPlan?.installments ?? []).map((installment) => ({
          label: installment.label,
          amountCents: installment.amountCents,
          due: installment.due,
        })));
  return { plan, installments, isEstimate: fromPublicPlan };
}

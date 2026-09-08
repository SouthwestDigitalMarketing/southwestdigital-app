"use client";

import dynamic from "next/dynamic";
import { useProposalAssessmentDemoState } from "@/app/(app)/offers/builder/ProposalCreationWorkspaceDemo";
import type { getUrgencyOfferDisplay } from "@/app/(app)/offers/builder/urgencyOffer";
import type { AgreementTemplateOption } from "@/lib/agreements/types";

// Client-only, matching how the builder embeds the preview. The proposal state
// lives in localStorage, so server rendering it would ship an empty-defaults
// proposal and flash it before the real draft arrives.
const OfferProposalPreview = dynamic(
  () => import("@/app/(app)/offers/builder/OfferProposalPreview"),
  {
    ssr: false,
    loading: () => <div className="p-8 text-sm text-slate-400">Loading proposal…</div>,
  },
);

export default function LiveOfferPreview({
  catalogOffer,
  agreementTemplates,
}: {
  catalogOffer: ReturnType<typeof getUrgencyOfferDisplay> | null;
  agreementTemplates: AgreementTemplateOption[];
}) {
  // Read-only mirror of the builder's draft, used only to resolve which
  // agreement the client would be shown. OfferProposalPreview subscribes
  // separately for its own render.
  const { assessment } = useProposalAssessmentDemoState({ persist: false, syncExternal: true });

  // Same precedence as the builder's embedded preview, so the two agree.
  const agreementTemplate =
    agreementTemplates.find((template) => template.id === assessment.agreementTemplateId)
    ?? agreementTemplates.find((template) => template.isDefault)
    ?? agreementTemplates[0]
    ?? null;

  return (
    <OfferProposalPreview
      mirrorBuilderState
      isStaffPreview
      catalogOffer={catalogOffer}
      agreementTemplate={agreementTemplate}
    />
  );
}

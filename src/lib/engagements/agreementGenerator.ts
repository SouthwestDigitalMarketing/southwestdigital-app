import {
  DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE,
  renderAgreementTemplate,
  type AgreementRenderInput,
} from "@/lib/agreements/template";

export type ProposalAgreementInput = AgreementRenderInput;

export function generateProposalAgreementText(input: ProposalAgreementInput) {
  return renderAgreementTemplate(DEFAULT_BOOKKEEPING_AGREEMENT_TEMPLATE, input);
}

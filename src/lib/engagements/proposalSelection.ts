export const PROPOSAL_TIER_IDS = ["grow", "improve", "maintain"] as const;

export type ProposalTierId = (typeof PROPOSAL_TIER_IDS)[number];

const PROPOSAL_TIER_ID_SET = new Set<string>(PROPOSAL_TIER_IDS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isProposalTierId(value: unknown): value is ProposalTierId {
  return typeof value === "string" && PROPOSAL_TIER_ID_SET.has(value);
}

export function getSelectedProposalTier(onboardingData: unknown): ProposalTierId | null {
  if (!isRecord(onboardingData)) return null;
  const proposalBuilderState = onboardingData.proposalBuilderState;
  if (!isRecord(proposalBuilderState)) return null;
  const services = proposalBuilderState.services;
  if (!isRecord(services)) return null;
  if (isProposalTierId(services.tier)) return services.tier;
  return isProposalTierId(services.selectedTier) ? services.selectedTier : null;
}

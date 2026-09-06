export function isProposalPreviewSimulation({
  live = true,
  embedded = false,
  isStaffPreview = false,
}: {
  live?: boolean;
  embedded?: boolean;
  isStaffPreview?: boolean;
}) {
  return !live || embedded || isStaffPreview;
}

export function resolveProposalInteractionEngagementId({
  live = true,
  embedded = false,
  isStaffPreview = false,
  engagementId,
  searchParamEngagementId,
}: {
  live?: boolean;
  embedded?: boolean;
  isStaffPreview?: boolean;
  engagementId?: string | null;
  searchParamEngagementId?: string | null;
}) {
  if (isProposalPreviewSimulation({ live, embedded, isStaffPreview })) return null;
  return engagementId ?? searchParamEngagementId ?? null;
}

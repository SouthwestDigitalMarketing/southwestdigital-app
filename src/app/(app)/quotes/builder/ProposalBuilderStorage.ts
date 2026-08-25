export const ASSESSMENT_STORAGE_KEY = "proposal-app-demo-assessment-v14";
export const CONTACT_INFO_STORAGE_KEY = "proposal-app-demo-contact-v1";

export function scopedProposalStorageKey(baseKey: string, engagementId?: string | null) {
  return engagementId ? `${baseKey}:${engagementId}` : baseKey;
}

export function readProposalBuilderLocalState(engagementId?: string | null) {
  const parse = (key: string) => {
    const raw = window.localStorage.getItem(scopedProposalStorageKey(key, engagementId));
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  };

  return {
    assessment: parse(ASSESSMENT_STORAGE_KEY),
    contactInfo: parse(CONTACT_INFO_STORAGE_KEY),
  };
}

export function writeProposalBuilderLocalState(
  engagementId: string,
  state: ReturnType<typeof readProposalBuilderLocalState>,
) {
  if (state.assessment) {
    window.localStorage.setItem(
      scopedProposalStorageKey(ASSESSMENT_STORAGE_KEY, engagementId),
      JSON.stringify(state.assessment),
    );
  }
  if (state.contactInfo) {
    window.localStorage.setItem(
      scopedProposalStorageKey(CONTACT_INFO_STORAGE_KEY, engagementId),
      JSON.stringify(state.contactInfo),
    );
  }
}

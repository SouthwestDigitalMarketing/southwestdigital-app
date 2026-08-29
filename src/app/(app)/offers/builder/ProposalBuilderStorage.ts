export const ASSESSMENT_STORAGE_KEY = "proposal-app-demo-assessment-v14";
export const CONTACT_INFO_STORAGE_KEY = "proposal-app-demo-contact-v1";

export function scopedProposalStorageKey(baseKey: string, engagementId?: string | null) {
  return engagementId ? `${baseKey}:${engagementId}` : baseKey;
}

function audienceStorageKey() {
  const params = new URLSearchParams(window.location.search);
  return params.get("offer") ?? params.get("contacts") ?? params.get("contact") ?? undefined;
}

export function readProposalBuilderLocalState(engagementId?: string | null) {
  const parse = (key: string) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  };

  const contactsKey = audienceStorageKey();
  const contactInfoKey = contactsKey
    ? `${CONTACT_INFO_STORAGE_KEY}:crm:${contactsKey}`
    : scopedProposalStorageKey(CONTACT_INFO_STORAGE_KEY, engagementId);

  return {
    assessment: parse(scopedProposalStorageKey(ASSESSMENT_STORAGE_KEY, engagementId ?? contactsKey)),
    contactInfo: parse(contactInfoKey),
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

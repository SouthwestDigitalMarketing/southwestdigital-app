export const ASSESSMENT_STORAGE_KEY = "proposal-app-demo-assessment-v14";
export const CONTACT_INFO_STORAGE_KEY = "proposal-app-demo-contact-v1";
export const PROPOSAL_BUILDER_STATE_CHANGE_EVENT = "proposal-builder-state-change";
const PROPOSAL_BUILDER_CHANNEL_NAME = "proposal-builder-state";

export type ProposalBuilderStateChangeDetail = {
  /** Storage key that changed, when the announcer knows it. */
  storageKey?: string;
};

let broadcastChannel: BroadcastChannel | null = null;
let broadcastChannelUnavailable = false;

function proposalBuilderChannel() {
  if (broadcastChannelUnavailable) return null;
  if (broadcastChannel) return broadcastChannel;
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    broadcastChannelUnavailable = true;
    return null;
  }
  try {
    broadcastChannel = new BroadcastChannel(PROPOSAL_BUILDER_CHANNEL_NAME);
    return broadcastChannel;
  } catch {
    // Safari private mode and locked-down embedders can refuse the constructor.
    broadcastChannelUnavailable = true;
    return null;
  }
}

/**
 * Notify every proposal surface that builder state changed.
 *
 * Fans out two ways: a window event for listeners in this tab, and a
 * BroadcastChannel message for the live preview tab. Only the changed key is
 * sent — localStorage stays the single source of truth and receivers re-read
 * from it, so a large assessment payload is never serialized twice.
 */
export function announceProposalBuilderStateChange(storageKey?: string) {
  if (typeof window === "undefined") return;

  const detail: ProposalBuilderStateChangeDetail = { storageKey };
  window.dispatchEvent(new CustomEvent(PROPOSAL_BUILDER_STATE_CHANGE_EVENT, { detail }));

  try {
    proposalBuilderChannel()?.postMessage(detail);
  } catch {
    // A closed or failed channel must never break an edit.
  }
}

/**
 * Subscribe to builder state changes from this tab and from other tabs.
 *
 * `listener` receives the changed storage key when it is known, and undefined
 * when the announcement did not name one (in which case treat it as "something
 * changed" and re-read). Returns an unsubscribe function.
 */
export function subscribeToProposalBuilderState(
  listener: (storageKey: string | undefined) => void,
) {
  if (typeof window === "undefined") return () => {};

  function handleWindowEvent(event: Event) {
    const detail = (event as CustomEvent<ProposalBuilderStateChangeDetail>).detail;
    listener(detail?.storageKey);
  }

  function handleChannelMessage(event: MessageEvent<ProposalBuilderStateChangeDetail>) {
    listener(event.data?.storageKey);
  }

  // The native storage event only fires in *other* tabs, which is exactly the
  // fallback we want when BroadcastChannel is unavailable. It is harmless when
  // the channel works: the raw-value guard in the sync hook drops duplicates.
  function handleStorageEvent(event: StorageEvent) {
    if (event.storageArea && event.storageArea !== window.localStorage) return;
    listener(event.key ?? undefined);
  }

  window.addEventListener(PROPOSAL_BUILDER_STATE_CHANGE_EVENT, handleWindowEvent);
  window.addEventListener("storage", handleStorageEvent);
  const channel = proposalBuilderChannel();
  channel?.addEventListener("message", handleChannelMessage);

  return () => {
    window.removeEventListener(PROPOSAL_BUILDER_STATE_CHANGE_EVENT, handleWindowEvent);
    window.removeEventListener("storage", handleStorageEvent);
    channel?.removeEventListener("message", handleChannelMessage);
  };
}

export function scopedProposalStorageKey(baseKey: string, engagementId?: string | null) {
  return engagementId ? `${baseKey}:${engagementId}` : baseKey;
}

function urlParam(name: string) {
  if (typeof window === "undefined") return undefined;
  return new URLSearchParams(window.location.search).get(name) ?? undefined;
}

/** The audience a builder draft belongs to, as carried in the URL. */
function audienceStorageKey() {
  return urlParam("offer") ?? urlParam("contacts") ?? urlParam("contact");
}

/**
 * Storage keys are derived in more than one place — the state hooks, the header
 * save path, and the live preview tab — and every consumer must agree exactly
 * or a surface silently reads someone else's draft. These two helpers are the
 * single definition of that derivation.
 */
export function assessmentStorageKey({
  engagementId,
}: { engagementId?: string | null } = {}) {
  const scopeId = engagementId ?? urlParam("engagementId") ?? audienceStorageKey();
  return scopedProposalStorageKey(ASSESSMENT_STORAGE_KEY, scopeId);
}

export function contactInfoStorageKey({
  engagementId,
}: { engagementId?: string | null } = {}) {
  // An explicit audience always wins: contact records are CRM-scoped.
  const audienceKey = audienceStorageKey();
  if (audienceKey) return `${CONTACT_INFO_STORAGE_KEY}:crm:${audienceKey}`;
  return scopedProposalStorageKey(
    CONTACT_INFO_STORAGE_KEY,
    engagementId ?? urlParam("engagementId"),
  );
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

  return {
    assessment: parse(assessmentStorageKey({ engagementId })),
    contactInfo: parse(contactInfoStorageKey({ engagementId })),
  };
}

export function writeProposalBuilderLocalState(
  engagementId: string,
  state: ReturnType<typeof readProposalBuilderLocalState>,
) {
  // Must use the same helpers the read path uses, or this writes to keys
  // nothing reads back.
  if (state.assessment) {
    window.localStorage.setItem(
      assessmentStorageKey({ engagementId }),
      JSON.stringify(state.assessment),
    );
  }
  if (state.contactInfo) {
    window.localStorage.setItem(
      contactInfoStorageKey({ engagementId }),
      JSON.stringify(state.contactInfo),
    );
  }
  announceProposalBuilderStateChange();
}

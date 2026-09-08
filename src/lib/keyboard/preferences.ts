/**
 * Browser-backed keyboard preferences, shaped as an external store so React can
 * read them with `useSyncExternalStore`.
 *
 * That API rather than a mount effect for two reasons: it has a first-class
 * server snapshot, so there is no hydration mismatch and no flash of the wrong
 * setting; and subscribing to the `storage` event means turning shortcuts off in
 * one tab turns them off in the others too, which is what a user changing an
 * accessibility setting expects.
 */

/**
 * Opt-out for shortcuts that fire without a modifier.
 *
 * Single-character shortcuts are a documented accessibility problem for speech
 * input and switch devices, whose input can emit stray characters. GitHub ships
 * the same setting; the help sheet exposes ours.
 */
export const SINGLE_KEY_STORAGE_KEY = "swapp.keyboard.singleKeyShortcuts";

const listeners = new Set<() => void>();

/** Cached so `getSnapshot` returns a stable value between real changes. */
let cachedEnabled: boolean | null = null;

function readStorage(): boolean {
  try {
    return window.localStorage.getItem(SINGLE_KEY_STORAGE_KEY) !== "off";
  } catch {
    // Private mode or blocked storage: the default (enabled) is correct.
    return true;
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeToSingleKeyPreference(listener: () => void): () => void {
  listeners.add(listener);

  // Cross-tab sync. `storage` only fires in *other* tabs, so the local setter
  // below invalidates and emits for this one.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== SINGLE_KEY_STORAGE_KEY) return;
    cachedEnabled = null;
    emit();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getSingleKeyPreference(): boolean {
  if (cachedEnabled === null) cachedEnabled = readStorage();
  return cachedEnabled;
}

/** Server and pre-hydration snapshot: shortcuts on, matching the default. */
export function getSingleKeyPreferenceServerSnapshot(): boolean {
  return true;
}

export function setSingleKeyPreference(enabled: boolean): void {
  cachedEnabled = enabled;
  try {
    window.localStorage.setItem(SINGLE_KEY_STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Preference does not persist, but the session still honours it.
  }
  emit();
}

/**
 * Platform detection, also as a store.
 *
 * Read after hydration rather than during render: the server has no `navigator`,
 * and guessing would render the wrong modifier symbol on first paint.
 */
const NO_OP_UNSUBSCRIBE = () => {};

export function subscribeToPlatform(): () => void {
  // The platform cannot change during a session, so there is nothing to watch.
  return NO_OP_UNSUBSCRIBE;
}

export function getIsMac(): boolean {
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}

export function getIsMacServerSnapshot(): boolean {
  return false;
}

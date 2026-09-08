"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { chordCandidates, formatSequence, type Chord } from "@/lib/keyboard/chords";
import {
  getIsMac,
  getIsMacServerSnapshot,
  getSingleKeyPreference,
  getSingleKeyPreferenceServerSnapshot,
  setSingleKeyPreference,
  subscribeToPlatform,
  subscribeToSingleKeyPreference,
} from "@/lib/keyboard/preferences";
import {
  activeBindings,
  flattenCommands,
  type Command,
  type CommandScope,
  type FlatCommand,
} from "@/lib/keyboard/registry";
import { EMPTY_SEQUENCE_STATE, feedSequence, SEQUENCE_TIMEOUT_MS, type SequenceState } from "@/lib/keyboard/sequences";
import { chordAllowedWhileTyping, isTypingContext } from "@/lib/keyboard/typingContext";
import { CommandMenu } from "./CommandMenu";
import { useLatestRef } from "./useLatestRef";
import { ShortcutHelp } from "./ShortcutHelp";

type ActionHandler = () => void;

type KeyboardContextValue = {
  commands: FlatCommand[];
  isMac: boolean;
  /** Chords typed so far in an unfinished sequence, for the on-screen hint. */
  pending: Chord[];
  activeScopes: ReadonlySet<CommandScope>;
  menuOpen: boolean;
  helpOpen: boolean;
  singleKeyShortcutsEnabled: boolean;
  setSingleKeyShortcutsEnabled: (enabled: boolean) => void;
  openMenu: () => void;
  closeMenu: () => void;
  openHelp: () => void;
  closeHelp: () => void;
  isCommandAvailable: (command: FlatCommand | Command) => boolean;
  runCommand: (command: FlatCommand | Command) => void;
};

const KeyboardContext = createContext<KeyboardContextValue | null>(null);

/**
 * Registration API, deliberately split from the value above.
 *
 * The main context value changes on every keystroke (it carries `pending`,
 * `menuOpen`, and the live scope set). If `useKeyboardScope` depended on that
 * object, its effect would re-run constantly: pop the scope, push it again,
 * mutate `scopeCounts`, produce a new context value, and re-run — an infinite
 * loop. These two callbacks never change identity, so effects that depend on
 * them fire exactly once per mount.
 */
type KeyboardApi = {
  registerAction: (id: string, handler: ActionHandler) => () => void;
  pushScope: (scope: CommandScope) => () => void;
};

const KeyboardApiContext = createContext<KeyboardApi | null>(null);

export function useKeyboard(): KeyboardContextValue {
  const value = useContext(KeyboardContext);
  if (!value) throw new Error("useKeyboard must be used inside <KeyboardProvider>");
  return value;
}

/** For components that may also render outside the authenticated shell. */
export function useKeyboardOptional(): KeyboardContextValue | null {
  return useContext(KeyboardContext);
}

export function KeyboardProvider({
  commands: commandTree,
  children,
}: {
  commands: readonly Command[];
  children: ReactNode;
}) {
  const router = useRouter();
  const commands = useMemo(() => flattenCommands(commandTree), [commandTree]);

  // Both are browser facts with no server equivalent, so they are read through
  // an external store: a server snapshot avoids a hydration mismatch, and the
  // preference additionally syncs across tabs.
  const isMac = useSyncExternalStore(subscribeToPlatform, getIsMac, getIsMacServerSnapshot);
  const singleKeyShortcutsEnabled = useSyncExternalStore(
    subscribeToSingleKeyPreference,
    getSingleKeyPreference,
    getSingleKeyPreferenceServerSnapshot,
  );

  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [registeredActions, setRegisteredActions] = useState<ReadonlySet<string>>(new Set());
  const [pending, setPending] = useState<Chord[]>([]);
  const [scopeCounts, setScopeCounts] = useState<Record<string, number>>({});

  const sequenceState = useRef<SequenceState>(EMPTY_SEQUENCE_STATE);
  const actionHandlers = useRef(new Map<string, ActionHandler[]>());

  const activeScopes = useMemo(() => {
    const scopes = new Set<CommandScope>(["global"]);
    Object.entries(scopeCounts).forEach(([scope, count]) => {
      if (count > 0) scopes.add(scope as CommandScope);
    });
    return scopes;
  }, [scopeCounts]);

  const pushScope = useCallback((scope: CommandScope) => {
    setScopeCounts((counts) => ({ ...counts, [scope]: (counts[scope] ?? 0) + 1 }));
    return () => {
      setScopeCounts((counts) => ({ ...counts, [scope]: Math.max(0, (counts[scope] ?? 1) - 1) }));
    };
  }, []);

  /**
   * Handlers stack per action id, most recently mounted wins. A nested surface
   * (a modal over a page) therefore takes precedence without either component
   * knowing the other exists.
   */
  const registerAction = useCallback((id: string, handler: ActionHandler) => {
    const existing = actionHandlers.current.get(id) ?? [];
    actionHandlers.current.set(id, [...existing, handler]);
    setRegisteredActions(new Set(actionHandlers.current.keys()));
    return () => {
      const handlers = actionHandlers.current.get(id) ?? [];
      const index = handlers.lastIndexOf(handler);
      if (index >= 0) {
        const next = [...handlers.slice(0, index), ...handlers.slice(index + 1)];
        if (next.length) actionHandlers.current.set(id, next);
        else actionHandlers.current.delete(id);
        setRegisteredActions(new Set(actionHandlers.current.keys()));
      }
    };
  }, []);

  const openMenu = useCallback(() => {
    setHelpOpen(false);
    setMenuOpen(true);
  }, []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const openHelp = useCallback(() => {
    setMenuOpen(false);
    setHelpOpen(true);
  }, []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);

  const runCommand = useCallback(
    (command: FlatCommand | Command) => {
      if (command.href) {
        // Only internal paths reach the router. `validateCommands` pins this in
        // tests too, but a bad href must never become a javascript: navigation.
        if (command.href.startsWith("/") && !command.href.startsWith("//")) {
          setMenuOpen(false);
          setHelpOpen(false);
          router.push(command.href);
        }
        return;
      }
      if (!command.action) return;

      switch (command.action) {
        case "menu.open":
          setHelpOpen(false);
          setMenuOpen((open) => !open);
          return;
        case "help.open":
          setMenuOpen(false);
          setHelpOpen((open) => !open);
          return;
        case "prefs.toggleSingleKeyShortcuts":
          setSingleKeyPreference(!getSingleKeyPreference());
          return;
        default:
          break;
      }

      const handlers = actionHandlers.current.get(command.action);
      const handler = handlers?.[handlers.length - 1];
      if (handler) {
        setMenuOpen(false);
        setHelpOpen(false);
        // Let the dialog unmount and restore focus before focusing page content.
        if (document.querySelector("dialog[open]")) requestAnimationFrame(handler);
        else handler();
      }
    },
    [router],
  );

  const isCommandAvailable = useCallback((command: FlatCommand | Command) => {
    if (!activeScopes.has(command.scope ?? "global")) return false;
    if (command.href) return true;
    return Boolean(command.action && (
      ["menu.open", "help.open", "prefs.toggleSingleKeyShortcuts"].includes(command.action) ||
      registeredActions.has(command.action)
    ));
  }, [activeScopes, registeredActions]);

  const bindings = useMemo(() => activeBindings(commands, activeScopes), [commands, activeScopes]);

  const runCommandRef = useLatestRef(runCommand);
  const bindingsRef = useLatestRef(bindings);
  const commandById = useMemo(() => new Map(commands.map((command) => [command.id, command])), [commands]);
  const commandsRef = useLatestRef(commandById);
  const isMacRef = useLatestRef(isMac);
  const singleKeyRef = useLatestRef(singleKeyShortcutsEnabled);
  // While an overlay owns the keyboard, global bindings stand down: the overlay
  // handles its own keys and would otherwise fight the sequence matcher.
  const overlayOpenRef = useLatestRef(menuOpen || helpOpen);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Never fight an IME: mid-composition every keystroke belongs to it, and
      // intercepting here destroys CJK and Vietnamese input.
      if (event.isComposing || event.keyCode === 229) return;
      if (event.defaultPrevented) return;
      if (overlayOpenRef.current) return;
      // Native dialogs and popovers own their keys, including non-text controls.
      if (document.querySelector("dialog:modal, [popover]:popover-open")) return;

      const typing = isTypingContext(
        event.target as unknown as Parameters<typeof isTypingContext>[0],
      );
      const candidates = chordCandidates(event, isMacRef.current);

      const availableBindings = bindingsRef.current.filter((binding) => {
        const command = commandsRef.current.get(binding.id);
        return command && (!command.action ||
          ["menu.open", "help.open", "prefs.toggleSingleKeyShortcuts"].includes(command.action) ||
          actionHandlers.current.has(command.action));
      });

      for (const chord of candidates) {
        if (typing && !chordAllowedWhileTyping(chord)) continue;
        // The accessibility opt-out: only modifier chords survive.
        if (!singleKeyRef.current && !chordAllowedWhileTyping(chord)) continue;

        const result = feedSequence(availableBindings, sequenceState.current, chord, Date.now());

        if (result.type === "match") {
          const command = commandsRef.current.get(result.id);
          sequenceState.current = result.state;
          setPending((current) => current.length ? [] : current);
          if (command) {
            // Only swallow a key once we know we are acting on it. Anything we
            // do not handle must reach the browser untouched.
            event.preventDefault();
            runCommandRef.current(command);
          }
          return;
        }

        if (result.type === "pending") {
          sequenceState.current = result.state;
          setPending(result.state.pending);
          // The queued prefix must be prevented too, or Firefox's quick-find
          // swallows the second key of the sequence.
          event.preventDefault();
          return;
        }
      }

      if (sequenceState.current.pending.length > 0) {
        sequenceState.current = EMPTY_SEQUENCE_STATE;
        setPending((current) => current.length ? [] : current);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bindingsRef, commandsRef, isMacRef, overlayOpenRef, runCommandRef, singleKeyRef]);

  /**
   * Mark the document once the global listener is attached.
   *
   * Until hydration completes there is no key handling at all, and nothing on
   * screen says so. This gives automated tests a signal to wait for instead of
   * racing hydration, and gives anyone debugging a "my shortcut did nothing"
   * report a way to tell "not mounted yet" from "bound but wrong".
   */
  useEffect(() => {
    document.documentElement.dataset.keyboardReady = "true";
    document.documentElement.dataset.keyboardScopes = [...activeScopes].join(" ");
    return () => {
      delete document.documentElement.dataset.keyboardReady;
      delete document.documentElement.dataset.keyboardScopes;
    };
  }, [activeScopes]);

  // The visible hint must expire along with the matcher's prefix.
  useEffect(() => {
    if (pending.length === 0) return;
    const timeout = window.setTimeout(() => {
      sequenceState.current = EMPTY_SEQUENCE_STATE;
      setPending((current) => current.length ? [] : current);
    }, SEQUENCE_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [pending]);

  // Drop a half-typed sequence when focus leaves the document, so returning to
  // the tab does not resume a prefix the user has long forgotten.
  useEffect(() => {
    function reset() {
      sequenceState.current = EMPTY_SEQUENCE_STATE;
      setPending((current) => current.length ? [] : current);
    }
    window.addEventListener("blur", reset);
    return () => window.removeEventListener("blur", reset);
  }, []);

  const value = useMemo<KeyboardContextValue>(
    () => ({
      commands,
      isMac,
      pending,
      activeScopes,
      menuOpen,
      helpOpen,
      singleKeyShortcutsEnabled,
      setSingleKeyShortcutsEnabled: setSingleKeyPreference,
      openMenu,
      closeMenu,
      openHelp,
      closeHelp,
      runCommand,
      isCommandAvailable,
    }),
    [
      commands,
      isMac,
      pending,
      activeScopes,
      menuOpen,
      helpOpen,
      singleKeyShortcutsEnabled,
      openMenu,
      closeMenu,
      openHelp,
      closeHelp,
      runCommand,
      isCommandAvailable,
    ],
  );

  const api = useMemo<KeyboardApi>(
    () => ({ registerAction, pushScope }),
    [registerAction, pushScope],
  );

  return (
    <KeyboardApiContext.Provider value={api}>
      <KeyboardContext.Provider value={value}>
        {children}
        <SequenceHint pending={pending} isMac={isMac} />
        {menuOpen ? <CommandMenu /> : null}
        {helpOpen ? <ShortcutHelp /> : null}
      </KeyboardContext.Provider>
    </KeyboardApiContext.Provider>
  );
}

/**
 * The "you pressed g, now what?" affordance — vim's `showcmd`, and the same job
 * as Hyprland's submap indicator. Without it a two-key sequence is a memory
 * test, and there is no proof the prefix was captured rather than swallowed.
 */
function SequenceHint({ pending, isMac }: { pending: Chord[]; isMac: boolean }) {
  if (pending.length === 0) return null;
  const label = formatSequence(pending, isMac);
  return (
    <div className="ui-key-hint" role="status" aria-live="polite">
      <span className="ui-key-hint-chord" aria-hidden="true">
        {label}
      </span>
      <span aria-hidden="true">…</span>
      <span className="sr-only">{`Waiting for the next key after ${label}`}</span>
    </div>
  );
}

/** Register a handler for a named command action while this component is mounted. */
export function useKeyboardAction(id: string, handler: ActionHandler, enabled = true): void {
  const api = useContext(KeyboardApiContext);
  const handlerRef = useLatestRef(handler);

  useEffect(() => {
    if (!api || !enabled) return;
    // The handler is read through a ref, so a caller passing an inline closure
    // does not re-register on every render.
    return api.registerAction(id, () => handlerRef.current());
  }, [api, id, enabled, handlerRef]);
}

/** Activate a command scope while this component is mounted. */
export function useKeyboardScope(scope: CommandScope, enabled = true): void {
  const api = useContext(KeyboardApiContext);
  useEffect(() => {
    if (!api || !enabled) return;
    return api.pushScope(scope);
  }, [api, scope, enabled]);
}

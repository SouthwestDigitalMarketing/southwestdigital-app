"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { chordCandidates, formatSequence, type Chord } from "@/lib/keyboard/chords";
import {
  activeBindings,
  flattenCommands,
  type Command,
  type CommandScope,
  type FlatCommand,
} from "@/lib/keyboard/registry";
import { EMPTY_SEQUENCE_STATE, feedSequence, type SequenceState } from "@/lib/keyboard/sequences";
import { chordAllowedWhileTyping, isTypingContext } from "@/lib/keyboard/typingContext";
import { CommandMenu } from "./CommandMenu";
import { ShortcutHelp } from "./ShortcutHelp";

type ActionHandler = () => void;

/**
 * Persisted opt-out for shortcuts that fire without a modifier.
 *
 * Single-character shortcuts are a documented accessibility problem for speech-
 * input and switch-device users, whose input can emit stray characters. GitHub
 * ships the same setting; so do we, and the help sheet exposes it.
 */
const SINGLE_KEY_PREFERENCE_STORAGE_KEY = "swapp.keyboard.singleKeyShortcuts";

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
  runCommand: (command: FlatCommand | Command) => void;
  registerAction: (id: string, handler: ActionHandler) => () => void;
  pushScope: (scope: CommandScope) => () => void;
  hasAction: (id: string) => boolean;
};

const KeyboardContext = createContext<KeyboardContextValue | null>(null);

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

  // Resolved after mount: reading navigator during render would desync hydration.
  const [isMac, setIsMac] = useState(false);
  const [singleKeyShortcutsEnabled, setSingleKeyShortcutsEnabledState] = useState(true);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.userAgent));
    try {
      const stored = window.localStorage.getItem(SINGLE_KEY_PREFERENCE_STORAGE_KEY);
      if (stored === "off") setSingleKeyShortcutsEnabledState(false);
    } catch {
      // Private mode or blocked storage: the default (enabled) is correct.
    }
  }, []);

  const setSingleKeyShortcutsEnabled = useCallback((enabled: boolean) => {
    setSingleKeyShortcutsEnabledState(enabled);
    try {
      window.localStorage.setItem(SINGLE_KEY_PREFERENCE_STORAGE_KEY, enabled ? "on" : "off");
    } catch {
      // Preference simply does not persist; the session still honours it.
    }
  }, []);

  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
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
    return () => {
      const handlers = actionHandlers.current.get(id) ?? [];
      const index = handlers.lastIndexOf(handler);
      if (index >= 0) {
        const next = [...handlers.slice(0, index), ...handlers.slice(index + 1)];
        if (next.length) actionHandlers.current.set(id, next);
        else actionHandlers.current.delete(id);
      }
    };
  }, []);

  const hasAction = useCallback((id: string) => actionHandlers.current.has(id), []);

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

  const singleKeyRef = useRef(singleKeyShortcutsEnabled);
  singleKeyRef.current = singleKeyShortcutsEnabled;

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
          setSingleKeyShortcutsEnabled(!singleKeyRef.current);
          return;
        default:
          break;
      }

      const handlers = actionHandlers.current.get(command.action);
      const handler = handlers?.[handlers.length - 1];
      if (handler) {
        setMenuOpen(false);
        setHelpOpen(false);
        handler();
      }
    },
    [router, setSingleKeyShortcutsEnabled],
  );

  const runCommandRef = useRef(runCommand);
  runCommandRef.current = runCommand;

  const bindings = useMemo(() => activeBindings(commands, activeScopes), [commands, activeScopes]);
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  const commandsRef = useRef(commands);
  commandsRef.current = commands;

  const isMacRef = useRef(isMac);
  isMacRef.current = isMac;

  // While an overlay owns the keyboard, global bindings stand down: the overlay
  // handles its own keys and would otherwise fight the sequence matcher.
  const overlayOpenRef = useRef(false);
  overlayOpenRef.current = menuOpen || helpOpen;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Never fight an IME: mid-composition every keystroke belongs to it, and
      // intercepting here destroys CJK and Vietnamese input.
      if (event.isComposing || event.keyCode === 229) return;
      if (event.defaultPrevented) return;
      if (overlayOpenRef.current) return;

      const typing = isTypingContext(event.target as unknown as Parameters<typeof isTypingContext>[0]);
      const candidates = chordCandidates(event, isMacRef.current);

      for (const chord of candidates) {
        if (typing && !chordAllowedWhileTyping(chord)) continue;
        // The accessibility opt-out: only modifier chords survive.
        if (!singleKeyRef.current && !chordAllowedWhileTyping(chord)) continue;

        const result = feedSequence(bindingsRef.current, sequenceState.current, chord, Date.now());

        if (result.type === "match") {
          const command = commandsRef.current.find((item) => item.id === result.id);
          sequenceState.current = result.state;
          setPending([]);
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
        setPending([]);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Drop a half-typed sequence when focus leaves the document, so returning to
  // the tab does not resume a prefix the user has long forgotten.
  useEffect(() => {
    function reset() {
      sequenceState.current = EMPTY_SEQUENCE_STATE;
      setPending([]);
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
      setSingleKeyShortcutsEnabled,
      openMenu,
      closeMenu,
      openHelp,
      closeHelp,
      runCommand,
      registerAction,
      pushScope,
      hasAction,
    }),
    [
      commands,
      isMac,
      pending,
      activeScopes,
      menuOpen,
      helpOpen,
      singleKeyShortcutsEnabled,
      setSingleKeyShortcutsEnabled,
      openMenu,
      closeMenu,
      openHelp,
      closeHelp,
      runCommand,
      registerAction,
      pushScope,
      hasAction,
    ],
  );

  return (
    <KeyboardContext.Provider value={value}>
      {children}
      <SequenceHint pending={pending} isMac={isMac} />
      {menuOpen ? <CommandMenu /> : null}
      {helpOpen ? <ShortcutHelp /> : null}
    </KeyboardContext.Provider>
  );
}

/**
 * The "you pressed g, now what?" affordance — vim's `showcmd`, and the same job
 * as Hyprland's submap indicator. Without it a two-key sequence is a memory
 * test, and there is no proof the prefix was captured rather than swallowed.
 */
function SequenceHint({ pending, isMac }: { pending: Chord[]; isMac: boolean }) {
  if (pending.length === 0) return null;
  return (
    <div className="ui-key-hint" role="status" aria-live="polite">
      <span className="ui-key-hint-chord" aria-hidden="true">
        {formatSequence(pending, isMac)}
      </span>
      <span aria-hidden="true">…</span>
      <span className="sr-only">{`Waiting for the next key after ${formatSequence(pending, isMac)}`}</span>
    </div>
  );
}

/** Register a handler for a named command action while this component is mounted. */
export function useKeyboardAction(id: string, handler: ActionHandler, enabled = true): void {
  const keyboard = useKeyboardOptional();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!keyboard || !enabled) return;
    return keyboard.registerAction(id, () => handlerRef.current());
  }, [keyboard, id, enabled]);
}

/** Activate a command scope while this component is mounted. */
export function useKeyboardScope(scope: CommandScope, enabled = true): void {
  const keyboard = useKeyboardOptional();
  useEffect(() => {
    if (!keyboard || !enabled) return;
    return keyboard.pushScope(scope);
  }, [keyboard, scope, enabled]);
}

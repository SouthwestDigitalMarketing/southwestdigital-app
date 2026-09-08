import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The module caches a BroadcastChannel at module scope, so each test needs a
// fresh import against a freshly stubbed window.
async function loadStorageModule() {
  vi.resetModules();
  return import("./ProposalBuilderStorage");
}

class FakeWindow extends EventTarget {
  localStorage = new Map<string, string>();
  location = { search: "" };
}

let fakeWindow: FakeWindow;

beforeEach(() => {
  fakeWindow = new FakeWindow();
  vi.stubGlobal("window", fakeWindow);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("announceProposalBuilderStateChange", () => {
  it("delivers the changed storage key to same-tab subscribers", async () => {
    const { announceProposalBuilderStateChange, subscribeToProposalBuilderState } =
      await loadStorageModule();

    const received: (string | undefined)[] = [];
    subscribeToProposalBuilderState((key) => received.push(key));

    announceProposalBuilderStateChange("assessment:offer-1");

    expect(received).toEqual(["assessment:offer-1"]);
  });

  it("delivers undefined when the announcement does not name a key", async () => {
    const { announceProposalBuilderStateChange, subscribeToProposalBuilderState } =
      await loadStorageModule();

    const received: (string | undefined)[] = [];
    subscribeToProposalBuilderState((key) => received.push(key));

    announceProposalBuilderStateChange();

    // Receivers treat undefined as "something changed" and re-read.
    expect(received).toEqual([undefined]);
  });

  it("stops delivering after unsubscribe", async () => {
    const { announceProposalBuilderStateChange, subscribeToProposalBuilderState } =
      await loadStorageModule();

    const received: (string | undefined)[] = [];
    const unsubscribe = subscribeToProposalBuilderState((key) => received.push(key));

    announceProposalBuilderStateChange("a");
    unsubscribe();
    announceProposalBuilderStateChange("b");

    expect(received).toEqual(["a"]);
  });

  it("is a no-op during server rendering", async () => {
    vi.stubGlobal("window", undefined);
    const { announceProposalBuilderStateChange, subscribeToProposalBuilderState } =
      await loadStorageModule();

    const unsubscribe = subscribeToProposalBuilderState(() => {
      throw new Error("must not fire without a window");
    });

    expect(() => announceProposalBuilderStateChange("a")).not.toThrow();
    expect(() => unsubscribe()).not.toThrow();
  });
});

describe("cross-tab storage event fallback", () => {
  it("forwards the key from a native storage event", async () => {
    const { subscribeToProposalBuilderState } = await loadStorageModule();

    const received: (string | undefined)[] = [];
    subscribeToProposalBuilderState((key) => received.push(key));

    // A real StorageEvent is a DOM type; the listener only reads .key and
    // .storageArea, so a shaped event carries the same information.
    const event = new Event("storage") as Event & { key: string; storageArea: null };
    Object.assign(event, { key: "contact:offer-9", storageArea: null });
    fakeWindow.dispatchEvent(event);

    expect(received).toEqual(["contact:offer-9"]);
  });

  it("ignores storage events from a different storage area", async () => {
    const { subscribeToProposalBuilderState } = await loadStorageModule();

    const received: (string | undefined)[] = [];
    subscribeToProposalBuilderState((key) => received.push(key));

    const event = new Event("storage") as Event & { key: string; storageArea: unknown };
    Object.assign(event, { key: "ignored", storageArea: { notLocalStorage: true } });
    fakeWindow.dispatchEvent(event);

    expect(received).toEqual([]);
  });
});

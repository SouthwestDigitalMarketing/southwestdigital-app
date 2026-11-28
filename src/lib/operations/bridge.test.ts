import { describe, expect, it } from "vitest";
import { BRIDGE_STALE_MS, bridgeView, parseBridgeReport } from "./bridge";

const now = new Date("2026-11-28T15:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const row = (over: Record<string, unknown>) => ({
  key: "chatgpt-bridge", enabled: false, changedAt: null, changedBy: null, mode: null, heartbeatAt: null,
  lastCheckAt: null, lastMessageAt: null, lastMessageUid: null, lastError: null, updatedAt: now, ...over,
}) as Parameters<typeof bridgeView>[0];

describe("parseBridgeReport", () => {
  it("accepts ripley's heartbeat and drops junk fields", () => {
    const r = parseBridgeReport({ mode: "idle", lastCheckAt: "2026-11-28T14:59:30Z", lastMessageUid: 147232, lastError: "  ", turnOff: "yes" });
    expect(r).toMatchObject({ mode: "idle", lastMessageUid: 147232, lastError: null, turnOff: false });
    expect(typeof r !== "string" && r.lastCheckAt?.toISOString()).toBe("2026-11-28T14:59:30.000Z");
  });
  it("rejects a missing or unknown mode", () => {
    expect(parseBridgeReport(null)).toBe("JSON body required");
    expect(parseBridgeReport({ mode: "on" })).toMatch(/^mode must be/);
  });
  it("ignores bad uids and dates", () => {
    expect(parseBridgeReport({ mode: "off", lastMessageUid: -3, lastCheckAt: "soon" })).toMatchObject({ lastMessageUid: null, lastCheckAt: null });
  });
});

describe("bridgeView", () => {
  it("no row is off", () => expect(bridgeView(null, now).state).toBe("off"));
  it("on and ripley caught up shows its mode", () => {
    expect(bridgeView(row({ enabled: true, changedAt: ago(60_000), heartbeatAt: ago(5_000), mode: "active" }), now).state).toBe("active");
    expect(bridgeView(row({ enabled: true, changedAt: ago(60_000), heartbeatAt: ago(5_000), mode: "idle" }), now).state).toBe("idle");
  });
  it("a heartbeat older than the flip is still turning", () => {
    expect(bridgeView(row({ enabled: true, changedAt: ago(5_000), heartbeatAt: ago(20_000), mode: "off" }), now).state).toBe("turning-on");
    expect(bridgeView(row({ enabled: false, changedAt: ago(5_000), heartbeatAt: ago(20_000), mode: "idle" }), now).state).toBe("turning-off");
  });
  it("off and ripley reports off", () => {
    expect(bridgeView(row({ enabled: false, changedAt: ago(60_000), heartbeatAt: ago(5_000), mode: "off" }), now).state).toBe("off");
  });
  it("on with a stale heartbeat is not answering; off with one is just off", () => {
    expect(bridgeView(row({ enabled: true, heartbeatAt: ago(BRIDGE_STALE_MS + 1) }), now).state).toBe("not-answering");
    expect(bridgeView(row({ enabled: false, heartbeatAt: ago(BRIDGE_STALE_MS + 1) }), now).state).toBe("off");
  });
});

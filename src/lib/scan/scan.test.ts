import { describe, expect, it } from "vitest";
import { checkScanToken } from "./auth";
import { formatUpdatedAgo, looksLikeSignedReply, parseScanChange, parseScanLead, parseSignedHint, scanRunStaleness } from "./scan";

describe("scanRunStaleness", () => {
  const now = new Date("2026-11-23T12:00:00Z");
  const minutes = (n: number) => new Date(now.getTime() - n * 60_000).toISOString();
  it("calls a scan stale only when no poller could still take it", () => {
    expect(scanRunStaleness(null, now)).toBe("none");
    expect(scanRunStaleness({ status: "done", requestedAt: minutes(99), startedAt: minutes(99) }, now)).toBe("none");
    expect(scanRunStaleness({ status: "requested", requestedAt: minutes(1), startedAt: null }, now)).toBe("fresh");
    expect(scanRunStaleness({ status: "requested", requestedAt: minutes(10), startedAt: null }, now)).toBe("stale");
    expect(scanRunStaleness({ status: "running", requestedAt: minutes(40), startedAt: minutes(10) }, now)).toBe("fresh");
    expect(scanRunStaleness({ status: "running", requestedAt: minutes(90), startedAt: minutes(40) }, now)).toBe("stale");
    expect(scanRunStaleness({ status: "running", requestedAt: minutes(90), startedAt: null }, now)).toBe("stale");
  });
});

describe("checkScanToken", () => {
  const env = { SCAN_STATUS_TOKEN: "x".repeat(32) };
  it("accepts the bearer token", () => {
    expect(checkScanToken(`Bearer ${"x".repeat(32)}`, env)).toEqual({ ok: true, actorUserId: "scan-ripley" });
  });
  it("rejects wrong tokens and short setup", () => {
    expect(checkScanToken("Bearer wrong", env)).toEqual({ ok: false, status: 401 });
    expect(checkScanToken(null, env)).toEqual({ ok: false, status: 401 });
    expect(checkScanToken("Bearer x", {})).toEqual({ ok: false, status: 503 });
  });
});

describe("formatUpdatedAgo", () => {
  it("names minutes, hours and days", () => {
    const now = new Date("2026-11-23T04:00:00Z");
    expect(formatUpdatedAgo(null, now)).toBe("Never scanned");
    expect(formatUpdatedAgo(new Date("2026-11-23T03:59:40Z"), now)).toBe("Updated just now");
    expect(formatUpdatedAgo(new Date("2026-11-23T03:41:00Z"), now)).toBe("Updated 19 min ago");
    expect(formatUpdatedAgo(new Date("2026-11-23T01:00:00Z"), now)).toBe("Updated 3 h ago");
    expect(formatUpdatedAgo(new Date("2026-11-20T04:00:00Z"), now)).toBe("Updated 3 d ago");
  });
});

describe("scan payload parsing", () => {
  it("keeps well-formed changes, leads and hints", () => {
    expect(parseScanChange({ kind: "quo", text: "2 new leads" })).toEqual({ kind: "quo", text: "2 new leads" });
    expect(parseScanChange({ kind: "quo" })).toBeNull();
    expect(parseScanLead({ brand: "b", name: "Dana", email: "DANA@x.com" })).toMatchObject({
      brand: "b",
      name: "Dana",
      email: "dana@x.com",
    });
    expect(parseScanLead({ brand: "b", name: "x", email: "bad" })).toBeNull();
    expect(parseSignedHint({ fromEmail: "C@x.com", snippet: "signed!" })).toMatchObject({ fromEmail: "c@x.com" });
    expect(parseSignedHint({})).toBeNull();
  });
});

describe("looksLikeSignedReply", () => {
  it("spots signed hints and ignores ordinary mail", () => {
    expect(looksLikeSignedReply("Re: GSA", "I signed it, all done!")).toBe(true);
    expect(looksLikeSignedReply("Re: GSA", "Sent it back just now")).toBe(true);
    expect(looksLikeSignedReply("Re: Your bookkeeping proposal for SJ Equity LLC", "Done.")).toBe(true);
    expect(looksLikeSignedReply("Invoice question", "what do I owe?")).toBe(false);
    expect(looksLikeSignedReply("Re: cleanup", "thanks, when is it scheduled?")).toBe(false);
  });
});

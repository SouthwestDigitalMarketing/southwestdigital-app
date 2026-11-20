import { describe, expect, it } from "vitest";
import { afterFailedPin, hashPin, pinProblem, verifyPin } from "./pin";
import { readValue, signUnlock, signValue, unlockIsValid } from "./token";
import { pinChangeDue } from "./reminder";

describe("pinProblem", () => {
  it.each([
    ["482913", null],
    ["12345", "Use exactly 6 digits."],
    ["12345a", "Use exactly 6 digits."],
    ["777777", "Do not use the same digit six times."],
    ["123456", "Do not use a straight run like 123456."],
    ["654321", "Do not use a straight run like 123456."],
    ["890123", "Do not use a straight run like 123456."],
  ])("%s", (pin, problem) => {
    expect(pinProblem(pin)).toBe(problem);
  });
});

describe("hashPin / verifyPin", () => {
  it("accepts the right PIN and rejects a wrong one, and never stores the PIN", async () => {
    const stored = await hashPin("482913");
    expect(stored).not.toContain("482913");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(await verifyPin("482913", stored)).toBe(true);
    expect(await verifyPin("482914", stored)).toBe(false);
  });

  it("salts each hash", async () => {
    expect(await hashPin("482913")).not.toBe(await hashPin("482913"));
  });

  it("rejects a malformed stored value", async () => {
    expect(await verifyPin("482913", "nope")).toBe(false);
  });
});

describe("afterFailedPin", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  it("counts up to the limit, then locks for 15 minutes and resets the count", () => {
    expect(afterFailedPin(0, now)).toEqual({ failedCount: 1, lockedUntil: null });
    expect(afterFailedPin(3, now)).toEqual({ failedCount: 4, lockedUntil: null });
    expect(afterFailedPin(4, now)).toEqual({ failedCount: 0, lockedUntil: new Date("2026-11-20T12:15:00Z") });
  });
});

describe("signed values", () => {
  const secret = "test-secret";
  const now = 1_700_000_000_000;

  it("round-trips and expires", () => {
    const v = signValue(["a", "b"], now + 1000, secret);
    expect(readValue(v, now, secret)).toEqual(["a", "b"]);
    expect(readValue(v, now + 1000, secret)).toBeNull();
  });

  it("rejects tampering and a different secret", () => {
    const v = signValue(["a"], now + 1000, secret);
    expect(readValue(v.replace("a.", "b."), now, secret)).toBeNull();
    expect(readValue(v, now, "other")).toBeNull();
    expect(readValue(undefined, now, secret)).toBeNull();
  });

  it("unlock is tied to the user and the PIN version", () => {
    const v = signUnlock("user1", 111, now, secret);
    expect(unlockIsValid(v, "user1", 111, now, secret)).toBe(true);
    expect(unlockIsValid(v, "user2", 111, now, secret)).toBe(false);
    expect(unlockIsValid(v, "user1", 222, now, secret)).toBe(false);
    expect(unlockIsValid(v, "user1", 111, now + 8 * 3_600_000, secret)).toBe(false);
  });
});

describe("pinChangeDue", () => {
  it("is due once a new firm-local month starts, until changed", () => {
    const changed = new Date("2026-11-05T15:00:00Z");
    expect(pinChangeDue(changed, new Date("2026-11-30T15:00:00Z"))).toBe(false);
    expect(pinChangeDue(changed, new Date("2026-12-01T15:00:00Z"))).toBe(true);
    // 2026-12-01 03:00 UTC is still Nov 30 in Chicago.
    expect(pinChangeDue(changed, new Date("2026-12-01T03:00:00Z"))).toBe(false);
    expect(pinChangeDue(new Date("2026-12-01T16:00:00Z"), new Date("2026-12-20T15:00:00Z"))).toBe(false);
  });

  it("is not due before a PIN exists", () => {
    expect(pinChangeDue(null, new Date())).toBe(false);
  });
});

describe("PIN reset", () => {
  const secret = "test-secret";
  const now = 1_700_000_000_000;
  it("needs the same user and a sign-in after the request, within 15 minutes", async () => {
    const { signReset, resetAllowed } = await import("./token");
    const v = signReset("u1", now, secret);
    expect(resetAllowed(v, "u1", now + 60_000, now + 120_000, secret)).toBe(true);
    expect(resetAllowed(v, "u1", now - 1, now + 120_000, secret)).toBe(false); // old session
    expect(resetAllowed(v, "u2", now + 60_000, now + 120_000, secret)).toBe(false);
    expect(resetAllowed(v, "u1", now + 60_000, now + 15 * 60_000, secret)).toBe(false); // expired
  });
});

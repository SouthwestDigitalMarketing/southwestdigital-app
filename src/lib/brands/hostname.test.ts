import { describe, expect, it } from "vitest";
import { normalizeHostname } from "./hostname";

describe("normalizeHostname", () => {
  it.each([
    ["APP.BookkeepingConroe.com", "app.bookkeepingconroe.com"],
    ["app.contigoaccounting.com:3000", "app.contigoaccounting.com"],
    ["app.melbournecfo.com.au.", "app.melbournecfo.com.au"],
    ["localhost:3000", "localhost"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeHostname(input)).toBe(expected);
  });

  it.each([null, undefined, "", "example.com/path", "good.com,evil.com", "user@example.com", "-bad.com"])(
    "rejects invalid hostname input %s",
    (input) => {
      expect(normalizeHostname(input)).toBeNull();
    },
  );
});


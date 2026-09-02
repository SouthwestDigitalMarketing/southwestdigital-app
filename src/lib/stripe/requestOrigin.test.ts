import { describe, expect, it } from "vitest";
import { requestOrigin } from "./requestOrigin";

describe("requestOrigin", () => {
  it("retains the local port after proxy hostname normalization", () => {
    const headers = new Headers({
      host: "localhost:3000",
      "x-hostname": "localhost",
      "x-forwarded-proto": "http",
    });

    expect(requestOrigin(headers)).toBe("http://localhost:3000");
  });

  it("uses the forwarded public origin behind a trusted deployment proxy", () => {
    const headers = new Headers({
      host: "internal:3000",
      "x-forwarded-host": "app.contigoaccounting.com",
      "x-forwarded-proto": "https",
    });

    expect(requestOrigin(headers)).toBe("https://app.contigoaccounting.com");
  });

  it("falls back to the validated host when a forwarded host is malformed", () => {
    const headers = new Headers({
      host: "localhost:3000",
      "x-forwarded-host": "good.example,evil.example",
      "x-forwarded-proto": "http",
    });

    expect(requestOrigin(headers)).toBe("http://localhost:3000");
  });
});

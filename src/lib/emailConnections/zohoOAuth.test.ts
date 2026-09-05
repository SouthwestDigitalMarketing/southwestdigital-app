import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  buildZohoAuthorizationUrl,
  createZohoOAuthState,
  readZohoOAuthState,
  verifyZohoOAuthState,
  ZOHO_MAIL_SCOPES,
} from "./zohoOAuth";

beforeAll(() => {
  process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-only-secret-do-not-use-in-prod";
});

describe("buildZohoAuthorizationUrl", () => {
  it("targets the region's accounts host and includes the mail scopes and state", () => {
    const url = buildZohoAuthorizationUrl({
      region: "EU",
      clientId: "1000.TEST",
      redirectUri: "https://app.example.com/api/email-connections/zoho/callback",
      state: "abc.def",
    });
    const parsed = new URL(url);
    expect(parsed.host).toBe("accounts.zoho.eu");
    expect(parsed.pathname).toBe("/oauth/v2/auth");
    expect(parsed.searchParams.get("client_id")).toBe("1000.TEST");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("access_type")).toBe("offline");
    expect(parsed.searchParams.get("prompt")).toBe("consent");
    expect(parsed.searchParams.get("state")).toBe("abc.def");
    expect(parsed.searchParams.get("redirect_uri")).toBe("https://app.example.com/api/email-connections/zoho/callback");
    expect(parsed.searchParams.get("scope")).toBe(ZOHO_MAIL_SCOPES.join(","));
  });
});

describe("OAuth state round-trip", () => {
  const membershipId = "membership_123";
  const brandId = "brand_bc";
  const returnOrigin = "http://localhost:3000";

  it("round-trips a valid state and reads back matching fields", () => {
    const state = createZohoOAuthState({ membershipId, brandId, region: "US", returnOrigin });
    const parsed = readZohoOAuthState(state);
    expect(parsed).not.toBeNull();
    expect(parsed?.membershipId).toBe(membershipId);
    expect(parsed?.brandId).toBe(brandId);
    expect(parsed?.region).toBe("US");
    expect(parsed?.returnOrigin).toBe(returnOrigin);
  });

  it("verify accepts a matching membership+brand+origin", () => {
    const state = createZohoOAuthState({ membershipId, brandId, region: "US", returnOrigin });
    expect(verifyZohoOAuthState(state, { membershipId, brandId, returnOrigin })).not.toBeNull();
  });

  it("verify rejects a state that belongs to a different membership", () => {
    const state = createZohoOAuthState({ membershipId, brandId, region: "US", returnOrigin });
    expect(verifyZohoOAuthState(state, { membershipId: "another_membership", brandId, returnOrigin })).toBeNull();
  });

  it("verify rejects a state that belongs to a different brand", () => {
    const state = createZohoOAuthState({ membershipId, brandId, region: "US", returnOrigin });
    expect(verifyZohoOAuthState(state, { membershipId, brandId: "brand_other", returnOrigin })).toBeNull();
  });

  it("verify rejects a state with a different return origin", () => {
    const state = createZohoOAuthState({ membershipId, brandId, region: "US", returnOrigin });
    expect(verifyZohoOAuthState(state, { membershipId, brandId, returnOrigin: "https://evil.example.com" })).toBeNull();
  });

  it("rejects a tampered payload (signature mismatch)", () => {
    const state = createZohoOAuthState({ membershipId, brandId, region: "US", returnOrigin });
    const [payload, signature] = state.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ membershipId: "evil", brandId, region: "US", returnOrigin, exp: Date.now() + 60_000 }),
    ).toString("base64url");
    expect(readZohoOAuthState(`${tamperedPayload}.${signature}`)).toBeNull();
    expect(readZohoOAuthState(`${payload}.deadbeef`)).toBeNull();
  });

  it("rejects a state whose region is unknown", () => {
    const badPayload = Buffer.from(
      JSON.stringify({ membershipId, brandId, region: "XX", returnOrigin, exp: Date.now() + 60_000 }),
    ).toString("base64url");
    expect(readZohoOAuthState(`${badPayload}.whatever`)).toBeNull();
  });

  it("rejects expired state before it can supply a relay destination", () => {
    vi.useFakeTimers();
    try {
      const state = createZohoOAuthState({ membershipId, brandId, region: "US", returnOrigin });
      vi.advanceTimersByTime(11 * 60_000);
      expect(readZohoOAuthState(state)).toBeNull();
    } finally { vi.useRealTimers(); }
  });

  it("rejects unsigned relay payloads and extra state segments", () => {
    const unsigned = Buffer.from(JSON.stringify({ returnOrigin: "https://attacker.example" })).toString("base64url");
    expect(readZohoOAuthState(unsigned)).toBeNull();
    const state = createZohoOAuthState({ membershipId, brandId, region: "US", returnOrigin });
    expect(readZohoOAuthState(`${state}.extra`)).toBeNull();
  });

  it("rejects signed insecure remote origins", () => {
    const state = createZohoOAuthState({ membershipId, brandId, region: "US", returnOrigin: "http://remote.example" });
    expect(readZohoOAuthState(state)).toBeNull();
  });
});

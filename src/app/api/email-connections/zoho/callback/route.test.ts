import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createZohoOAuthState } from "@/lib/emailConnections/zohoOAuth";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  allowed: vi.fn(),
  staff: vi.fn(),
  exchange: vi.fn(),
  upsert: vi.fn(),
  cookie: vi.fn(),
  removeCookie: vi.fn(),
  account: vi.fn(),
  host: "platform.example.test",
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: mocks.host, "x-forwarded-proto": "https" }),
  cookies: async () => ({ get: mocks.cookie, delete: mocks.removeCookie }),
}));
vi.mock("@/lib/brands/staff", () => ({ requireStaffBrandOrThrow: mocks.staff }));
vi.mock("@/lib/integrations/callbackOrigin", () => ({ isAuthorizedCallbackOrigin: mocks.allowed }));
vi.mock("@/lib/emailConnections/repository", () => ({ upsertZohoConnection: mocks.upsert }));
vi.mock("@/lib/emailConnections/zohoMail", () => ({
  exchangeZohoAuthorizationCode: mocks.exchange,
  fetchPrimaryZohoAccount: mocks.account,
}));

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", "test-secret-not-for-production");
  vi.stubEnv("PLATFORM_BASE_URL", "https://platform.example.test");
  vi.stubEnv("NODE_ENV", "production");
  mocks.host = "platform.example.test";
  mocks.allowed.mockResolvedValue(true);
  mocks.staff.mockResolvedValue({ brand: { id: "brand" }, membership: { id: "member" } });
  mocks.cookie.mockReturnValue(undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function signZohoPayload(payload: object) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", process.env.AUTH_SECRET!).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

const signedState = (origin = "https://firm.example.test") =>
  createZohoOAuthState({ brandId: "brand", membershipId: "member", returnOrigin: origin, region: "US" });

const callback = (state: string, origin = "https://platform.example.test", extra: Record<string, string> = {}) => {
  mocks.host = new URL(origin).host;
  const url = new URL("/api/email-connections/zoho/callback", origin);
  url.searchParams.set("state", state);
  for (const [k, v] of Object.entries({ code: "PRIVATE_CODE", ...extra })) url.searchParams.set(k, v);
  return GET(new Request(url));
};

function expectPlatformErrorNoRelay(location: string | null) {
  expect(location).toBe("https://platform.example.test/settings?email=error");
  expect(new URL(location!).origin).not.toBe("https://firm.example.test");
  expect(location).not.toContain("PRIVATE_CODE");
  expect(mocks.allowed).not.toHaveBeenCalled();
  expect(mocks.exchange).not.toHaveBeenCalled();
}

describe("Zoho callback relay", () => {
  it("never forwards a code using an unsigned return origin", async () => {
    const unsigned = Buffer.from(JSON.stringify({ returnOrigin: "https://attacker.example.test" })).toString("base64url");
    const response = await callback(`${unsigned}.forged`);
    expect(response.headers.get("location")).toBe("https://platform.example.test/settings?email=error");
    expect(mocks.allowed).not.toHaveBeenCalled();
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it("relays valid state only to an authorized destination", async () => {
    const state = signedState();
    const response = await callback(state);
    const target = new URL(response.headers.get("location")!);
    expect(target.origin).toBe("https://firm.example.test");
    expect(target.searchParams.get("code")).toBe("PRIVATE_CODE");
    expect(target.searchParams.get("state")).toBe(state);
    expect(mocks.allowed).toHaveBeenCalledWith("https://firm.example.test", "brand");
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it("does not relay signed state to a retired domain", async () => {
    mocks.allowed.mockResolvedValue(false);
    const response = await callback(signedState());
    expect(response.headers.get("location")).toBe("https://platform.example.test/settings?email=error");
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it("requires the original browser cookie before exchanging a code", async () => {
    mocks.cookie.mockReturnValue(undefined);
    const response = await callback(signedState("https://platform.example.test"));
    expect(response.headers.get("location")).toBe("https://platform.example.test/settings?email=error");
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("never relays expired state", async () => {
    vi.useFakeTimers();
    try {
      const state = signedState();
      vi.advanceTimersByTime(11 * 60_000);
      const response = await callback(state);
      expectPlatformErrorNoRelay(response.headers.get("location"));
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    "javascript:alert(1)",
    "https://user:secret@firm.example.test",
    "https://firm.example.test/path",
    "http://remote.example.test",
  ])("never relays HMAC-valid malformed origins: %s", async (returnOrigin) => {
    const state = signZohoPayload({
      membershipId: "member",
      brandId: "brand",
      region: "US",
      returnOrigin,
      exp: Date.now() + 60_000,
    });
    const response = await callback(state);
    expectPlatformErrorNoRelay(response.headers.get("location"));
  });

  it("completes a valid platform-to-brand round trip only after cookie and membership bind", async () => {
    const state = signedState();
    const hop1 = await callback(state);
    const hop1Target = new URL(hop1.headers.get("location")!);
    expect(hop1Target.origin).toBe("https://firm.example.test");
    expect(hop1Target.pathname).toBe("/api/email-connections/zoho/callback");
    expect(hop1Target.searchParams.get("code")).toBe("PRIVATE_CODE");
    expect(hop1Target.searchParams.get("state")).toBe(state);
    expect(mocks.allowed).toHaveBeenCalledWith("https://firm.example.test", "brand");
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.staff).not.toHaveBeenCalled();

    vi.stubEnv("ZOHO_MAIL_CLIENT_ID", "zoho-client");
    vi.stubEnv("ZOHO_MAIL_CLIENT_SECRET", "zoho-secret");
    mocks.cookie.mockReturnValue({ value: state });
    mocks.exchange.mockResolvedValue({
      accessToken: "at",
      refreshToken: "rt",
      expiresInSeconds: 3600,
      scope: "ZohoMail.messages.CREATE",
    });
    mocks.account.mockResolvedValue({
      accountId: "acc",
      primaryEmailAddress: "staff@firm.example.test",
      displayName: "Staff",
    });

    const hop2 = await callback(state, "https://firm.example.test");
    expect(hop2.headers.get("location")).toBe("https://firm.example.test/settings?email=connected");
    expect(mocks.exchange).toHaveBeenCalledTimes(1);
    expect(mocks.exchange).toHaveBeenCalledWith(
      expect.objectContaining({
        redirectUri: "https://platform.example.test/api/email-connections/zoho/callback",
        code: "PRIVATE_CODE",
      }),
    );
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        brandId: "brand",
        membershipId: "member",
        emailAddress: "staff@firm.example.test",
      }),
    );
    expect(mocks.removeCookie).toHaveBeenCalled();
  });

  it("second hop without the origin cookie does not exchange a code", async () => {
    const state = signedState();
    const response = await callback(state, "https://firm.example.test");
    expect(response.headers.get("location")).toBe("https://firm.example.test/settings?email=error");
    expect(response.headers.get("location")).not.toContain("PRIVATE_CODE");
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it("second hop with a different brand does not exchange a code", async () => {
    const state = signedState();
    mocks.cookie.mockReturnValue({ value: state });
    mocks.staff.mockResolvedValue({ brand: { id: "other" }, membership: { id: "member" } });
    const response = await callback(state, "https://firm.example.test");
    expect(response.headers.get("location")).toBe("https://firm.example.test/settings?email=error");
    expect(response.headers.get("location")).not.toContain("PRIVATE_CODE");
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
});

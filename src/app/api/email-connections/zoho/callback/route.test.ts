import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createZohoOAuthState } from "@/lib/emailConnections/zohoOAuth";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ allowed: vi.fn(), staff: vi.fn(), exchange: vi.fn(), upsert: vi.fn(), cookie: vi.fn(), removeCookie: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "platform.example.test", "x-forwarded-proto": "https" }),
  cookies: async () => ({ get: mocks.cookie, delete: mocks.removeCookie }),
}));
vi.mock("@/lib/brands/staff", () => ({ requireStaffBrandOrThrow: mocks.staff }));
vi.mock("@/lib/integrations/callbackOrigin", () => ({ isAuthorizedCallbackOrigin: mocks.allowed }));
vi.mock("@/lib/emailConnections/repository", () => ({ upsertZohoConnection: mocks.upsert }));
vi.mock("@/lib/emailConnections/zohoMail", () => ({ exchangeZohoAuthorizationCode: mocks.exchange, fetchPrimaryZohoAccount: vi.fn() }));

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", "test-secret-not-for-production");
  vi.stubEnv("PLATFORM_BASE_URL", "https://platform.example.test");
  mocks.allowed.mockResolvedValue(true);
  mocks.staff.mockResolvedValue({ brand: { id: "brand" }, membership: { id: "member" } });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

const signedState = (origin = "https://firm.example.test") => createZohoOAuthState({ brandId: "brand", membershipId: "member", returnOrigin: origin, region: "US" });
const callback = (state: string) => GET(new Request(`https://platform.example.test/api/email-connections/zoho/callback?code=PRIVATE_CODE&state=${encodeURIComponent(state)}`));

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
  });
  it("requires the original browser cookie before exchanging a code", async () => {
    mocks.cookie.mockReturnValue(undefined);
    const response = await callback(signedState("https://platform.example.test"));
    expect(response.headers.get("location")).toBe("https://platform.example.test/settings?email=error");
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});

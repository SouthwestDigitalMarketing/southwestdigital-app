import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isAuthorizedCallbackOrigin } from "./callbackOrigin";

const mocks = vi.hoisted(() => ({ brand: vi.fn(), domain: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { brand: { findFirst: mocks.brand } } }));
vi.mock("@/lib/brands/repository", () => ({ resolveAppBrandByHostname: mocks.domain }));

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("PLATFORM_BASE_URL", "https://platform.example.test");
  mocks.brand.mockResolvedValue({ id: "active-brand" });
  mocks.domain.mockResolvedValue(null);
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("OAuth relay destination authorization", () => {
  it("requires an active brand and a verified app host", async () => {
    expect(await isAuthorizedCallbackOrigin("https://retired.example.test", "active-brand")).toBe(false);
    mocks.domain.mockResolvedValue({ id: "entry-brand" });
    expect(await isAuthorizedCallbackOrigin("https://verified.example.test", "active-brand")).toBe(true);
    expect(mocks.brand).toHaveBeenCalledWith({ where: { id: "active-brand", status: "ACTIVE" }, select: { id: true } });
    mocks.brand.mockResolvedValue(null);
    expect(await isAuthorizedCallbackOrigin("https://verified.example.test", "suspended-brand")).toBe(false);
  });

  it("allows the configured platform origin but not lookalikes", async () => {
    expect(await isAuthorizedCallbackOrigin("https://platform.example.test", "active-brand")).toBe(true);
    expect(await isAuthorizedCallbackOrigin("https://platform.example.test.attacker.test", "active-brand")).toBe(false);
  });

  it.each(["javascript:alert(1)", "https://user:secret@platform.example.test", "https://platform.example.test/path", "http://platform.example.test", "http://localhost:3000"])("rejects unsafe production origin %s", async (origin) => {
    expect(await isAuthorizedCallbackOrigin(origin, "active-brand")).toBe(false);
  });

  it("fails closed for invalid configuration", async () => {
    vi.stubEnv("PLATFORM_BASE_URL", "not-a-url");
    expect(await isAuthorizedCallbackOrigin("https://unknown.example.test", "active-brand")).toBe(false);
  });

  it("allows local development only for an active brand", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(await isAuthorizedCallbackOrigin("http://localhost:3000", "active-brand")).toBe(true);
    mocks.brand.mockResolvedValue(null);
    expect(await isAuthorizedCallbackOrigin("http://localhost:3000", "suspended-brand")).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PlatformRole, UserStatus } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  accessible: vi.fn(),
  entry: vi.fn(),
  companyHome: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/brands/repository", () => ({
  getAccessibleBrands: mocks.accessible,
  resolveAppBrandByHostname: mocks.entry,
  getCompanyHomeBrand: mocks.companyHome,
}));

import { GET } from "./route";

beforeEach(() => {
  Object.values(mocks).forEach((fn) => fn.mockReset());
  process.env.PLATFORM_BASE_URL = "https://admin.southwestdigital.io";
  mocks.auth.mockResolvedValue({ user: { id: "tom", status: UserStatus.ACTIVE, platformRole: PlatformRole.OWNER } });
  mocks.accessible.mockResolvedValue([]);
  mocks.companyHome.mockResolvedValue({ id: "bkc", slug: "bookkeeping-conroe" });
});

describe("post-login landing", () => {
  it("opens Lochside's dashboard on the platform host and sets BKC data scope", async () => {
    const response = await GET(new NextRequest("https://admin.southwestdigital.io/auth/complete", { headers: { host: "admin.southwestdigital.io" } }));
    expect(response.headers.get("location")).toBe("https://admin.southwestdigital.io/dashboard");
    expect(response.cookies.get("swd-active-brand")?.value).toBe("bkc");
    expect(mocks.entry).not.toHaveBeenCalled();
  });

  it("uses the bare-IP local platform host in development", async () => {
    process.env.PLATFORM_BASE_URL = "http://100.98.89.93:3101";
    const response = await GET(new NextRequest("http://100.98.89.93:3101/auth/complete", { headers: { host: "100.98.89.93:3101" } }));
    expect(response.headers.get("location")).toBe("http://100.98.89.93:3101/dashboard");
    expect(response.cookies.get("swd-active-brand")?.value).toBe("bkc");
  });

  it("keeps Contigo on its own entry hostname", async () => {
    mocks.entry.mockResolvedValue({ id: "contigo" });
    mocks.accessible.mockResolvedValue([{ id: "contigo" }]);
    const response = await GET(new NextRequest("https://app.contigoaccounting.com/auth/complete", { headers: { host: "app.contigoaccounting.com" } }));
    expect(response.headers.get("location")).toBe("https://app.contigoaccounting.com/dashboard");
    expect(response.cookies.get("swd-active-brand")?.value).toBe("contigo");
    expect(mocks.companyHome).not.toHaveBeenCalled();
  });

  it("does not let a brand-only member into the platform host", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "member", status: UserStatus.ACTIVE, platformRole: PlatformRole.NONE } });
    const response = await GET(new NextRequest("https://admin.southwestdigital.io/auth/complete", { headers: { host: "admin.southwestdigital.io" } }));
    expect(response.headers.get("location")).toBe("https://admin.southwestdigital.io/access-denied");
    expect(mocks.companyHome).not.toHaveBeenCalled();
  });
});

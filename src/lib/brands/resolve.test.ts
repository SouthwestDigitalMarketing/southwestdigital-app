import { BrandStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePublicBrand } from "./resolve";

const mocks = vi.hoisted(() => ({
  appHostname: vi.fn(),
  brand: vi.fn(),
}));

vi.mock("@/lib/brands/repository", () => ({
  resolveAppBrandByHostname: mocks.appHostname,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { brand: { findUnique: mocks.brand } },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolvePublicBrand", () => {
  it("resolvePublicBrand denies a suspended brand", async () => {
    mocks.appHostname.mockResolvedValue({ id: "brand" });
    mocks.brand.mockResolvedValue({
      id: "brand",
      slug: "firm",
      name: "Firm",
      status: BrandStatus.SUSPENDED,
      theme: null,
      toolLinks: [],
    });
    await expect(resolvePublicBrand("firm.example.test")).resolves.toBeNull();
  });

  it("resolvePublicBrand denies when the hostname is not a verified APP domain", async () => {
    mocks.appHostname.mockResolvedValue(null);
    await expect(resolvePublicBrand("disabled.example.test")).resolves.toBeNull();
    expect(mocks.brand).not.toHaveBeenCalled();
  });
});

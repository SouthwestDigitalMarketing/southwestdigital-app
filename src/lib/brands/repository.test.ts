import { BrandStatus, DomainPurpose, DomainStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAppBrandByHostname } from "./repository";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { brandDomain: { findFirst: mocks.findFirst } } }));

beforeEach(() => {
  mocks.findFirst.mockReset();
});

describe("resolveAppBrandByHostname", () => {
  it("looks up only verified APP hosts on an active brand", async () => {
    mocks.findFirst.mockResolvedValue({ brand: { id: "brand" } });
    await expect(resolveAppBrandByHostname("firm.example.test")).resolves.toEqual({ id: "brand" });
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          hostname: "firm.example.test",
          purpose: DomainPurpose.APP,
          status: DomainStatus.VERIFIED,
          brand: { status: BrandStatus.ACTIVE },
        },
      }),
    );
  });

  it("returns null when no verified APP domain row exists", async () => {
    mocks.findFirst.mockResolvedValue(null);
    await expect(resolveAppBrandByHostname("firm.example.test")).resolves.toBeNull();
  });
});

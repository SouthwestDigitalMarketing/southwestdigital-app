import { BrandRole, MembershipStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { canAdministerBrand, requireAdminBrandOrThrow, requireStaffBrandOrThrow } from "./staff";

const mocks = vi.hoisted(() => ({ context: vi.fn(), resolve: vi.fn() }));
vi.mock("@/lib/tenancy/current", () => ({ requireActiveBrandContext: mocks.context }));
vi.mock("@/lib/brands/resolve", () => ({ resolveBrandById: mocks.resolve }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));

beforeEach(() => {
  mocks.context.mockResolvedValue({ session: { user: { id: "user", platformRole: "NONE" } }, activeBrand: { id: "brand" }, accessibleBrands: [] });
  mocks.resolve.mockResolvedValue({ brand: { id: "brand", status: "ACTIVE" }, membership: { role: "MEMBER", status: "ACTIVE" } });
});

describe("brand administrator permissions", () => {
  it.each(Object.values(BrandRole))("only grants active owners and admins administration: %s", (role) => {
    expect(canAdministerBrand({ isPlatformOperator: false, membership: { role, status: MembershipStatus.ACTIVE } })).toBe(role === "OWNER" || role === "ADMIN");
  });
  it.each([MembershipStatus.INVITED, MembershipStatus.SUSPENDED])("denies inactive admin membership: %s", (status) => {
    expect(canAdministerBrand({ isPlatformOperator: false, membership: { role: BrandRole.ADMIN, status } })).toBe(false);
  });
  it("retains staff access while rejecting administrator mutations for a member", async () => {
    await expect(requireStaffBrandOrThrow()).resolves.toMatchObject({ brand: { id: "brand" } });
    await expect(requireAdminBrandOrThrow()).rejects.toThrow("Unauthorized");
  });
  it("rejects a brand suspended after session selection", async () => {
    mocks.resolve.mockResolvedValue({ brand: { id: "brand", status: "SUSPENDED" }, membership: { role: "OWNER", status: "ACTIVE" } });
    await expect(requireAdminBrandOrThrow()).rejects.toThrow("redirect:/select-brand");
  });
  it("recognizes platform operator privileges separately", async () => {
    mocks.context.mockResolvedValue({ session: { user: { id: "user", platformRole: "ADMIN" } }, activeBrand: { id: "brand" }, accessibleBrands: [] });
    mocks.resolve.mockResolvedValue({ brand: { id: "brand", status: "ACTIVE" }, membership: null });
    await expect(requireAdminBrandOrThrow()).resolves.toMatchObject({ isPlatformOperator: true });
  });
});

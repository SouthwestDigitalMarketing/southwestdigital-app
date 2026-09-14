import { beforeEach, describe, expect, it, vi } from "vitest";
import { findPublicReviewRequest } from "./publicAccess";

const mocks = vi.hoisted(() => ({ brand: vi.fn(), request: vi.fn() }));
vi.mock("@/lib/brands/resolve", () => ({ resolvePublicBrand: mocks.brand }));
vi.mock("@/lib/prisma", () => ({
  prisma: { reviewRequest: { findFirst: mocks.request } },
}));

const BRAND = { id: "brand", name: "Example Co" };
const ROW = {
  id: "req-1",
  token: "tok-1",
  brandId: "brand",
  recipientName: "Jane",
  openedAt: null,
  clickedAt: null,
  outcome: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.brand.mockResolvedValue(BRAND);
  mocks.request.mockResolvedValue(ROW);
});

describe("findPublicReviewRequest", () => {
  it("scopes the token to the host brand", async () => {
    await expect(
      findPublicReviewRequest({ hostname: "app.example.test", token: "tok-1" }),
    ).resolves.toEqual({ brand: BRAND, request: ROW });
    expect(mocks.brand).toHaveBeenCalledWith("app.example.test");
    expect(mocks.request).toHaveBeenCalledWith({
      where: { brandId: "brand", token: "tok-1" },
      select: {
        id: true,
        token: true,
        brandId: true,
        recipientName: true,
        openedAt: true,
        clickedAt: true,
        outcome: true,
      },
    });
  });

  it("returns null for a missing token without querying", async () => {
    await expect(findPublicReviewRequest({ hostname: "app.example.test", token: "  " })).resolves.toBeNull();
    expect(mocks.brand).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("returns null when the host brand is inactive or unresolved", async () => {
    mocks.brand.mockResolvedValue(null);
    await expect(
      findPublicReviewRequest({ hostname: "app.example.test", token: "tok-1" }),
    ).resolves.toBeNull();
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("returns null when the token belongs to another brand", async () => {
    mocks.request.mockResolvedValue(null);
    await expect(
      findPublicReviewRequest({ hostname: "app.example.test", token: "tok-1" }),
    ).resolves.toBeNull();
  });
});

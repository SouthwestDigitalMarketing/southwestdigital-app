import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePublicReviewOrigin } from "./publicOrigin";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { brandDomain: { findFirst: mocks.findFirst } } }));

const BRAND_ID = "brand-bc";
const PRIMARY = { hostname: "app.bookkeepingconroe.com" };

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("PLATFORM_BASE_URL", "https://admin.southwestdigital.io");
  mocks.findFirst.mockResolvedValue(PRIMARY);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("resolvePublicReviewOrigin", () => {
  it("returns https origin for a verified primary APP domain", async () => {
    await expect(resolvePublicReviewOrigin(BRAND_ID)).resolves.toBe("https://app.bookkeepingconroe.com");
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        brandId: BRAND_ID,
        purpose: "APP",
        status: "VERIFIED",
        brand: { status: "ACTIVE" },
      },
      orderBy: [{ isPrimary: "desc" }, { hostname: "asc" }],
      select: { hostname: true },
    });
  });

  it("prefers isPrimary then hostname ascending when several APP/VERIFIED rows exist", async () => {
    mocks.findFirst.mockResolvedValue({ hostname: "app.primary.example" });
    await expect(resolvePublicReviewOrigin(BRAND_ID)).resolves.toBe("https://app.primary.example");
    const query = mocks.findFirst.mock.calls[0][0] as { orderBy: unknown };
    expect(query.orderBy).toEqual([{ isPrimary: "desc" }, { hostname: "asc" }]);
  });

  it.each([null, undefined])("throws when no verified APP domain is found (%s)", async (row) => {
    mocks.findFirst.mockResolvedValue(row);
    await expect(resolvePublicReviewOrigin(BRAND_ID)).rejects.toThrow(
      "This brand has no verified app domain. Add and verify one before sending review requests.",
    );
  });

  it("throws when the verified hostname is the operator platform host", async () => {
    mocks.findFirst.mockResolvedValue({ hostname: "admin.southwestdigital.io" });
    await expect(resolvePublicReviewOrigin(BRAND_ID)).rejects.toThrow(
      "The operator platform host cannot be used as a public review link.",
    );
  });

  it("ignores AUTH_URL when building the origin", async () => {
    vi.stubEnv("AUTH_URL", "https://auth-should-not-win.example");
    vi.stubEnv("NEXTAUTH_URL", "https://nextauth-should-not-win.example");
    await expect(resolvePublicReviewOrigin(BRAND_ID)).resolves.toBe("https://app.bookkeepingconroe.com");
  });

  it("does not return PLATFORM_BASE_URL as the recipient origin", async () => {
    vi.stubEnv("PLATFORM_BASE_URL", "https://admin.southwestdigital.io");
    await expect(resolvePublicReviewOrigin(BRAND_ID)).resolves.toBe("https://app.bookkeepingconroe.com");
    expect(await resolvePublicReviewOrigin(BRAND_ID)).not.toBe("https://admin.southwestdigital.io");
  });

  it("uses http only for localhost in non-production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.findFirst.mockResolvedValue({ hostname: "localhost" });
    await expect(resolvePublicReviewOrigin(BRAND_ID)).resolves.toBe("http://localhost");
    mocks.findFirst.mockResolvedValue({ hostname: "127.0.0.1" });
    await expect(resolvePublicReviewOrigin(BRAND_ID)).resolves.toBe("http://127.0.0.1");
  });

  it("keeps https for localhost in production", async () => {
    mocks.findFirst.mockResolvedValue({ hostname: "localhost" });
    await expect(resolvePublicReviewOrigin(BRAND_ID)).resolves.toBe("https://localhost");
  });
});

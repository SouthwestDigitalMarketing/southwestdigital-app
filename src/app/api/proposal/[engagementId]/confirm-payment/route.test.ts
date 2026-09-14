import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ access: vi.fn(), engagement: vi.fn() }));
vi.mock("@/lib/engagements/publicProposalAccess", () => ({
  hasPublicProposalAccess: mocks.access,
  publicProposalNotFound: () => Response.json({}, { status: 404 }),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { engagement: { findUnique: mocks.engagement } } }));

const call = () => POST(
  new Request("https://firm.example.test/api/proposal/eng/confirm-payment", { method: "POST" }),
  { params: Promise.resolve({ engagementId: "eng" }) },
);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.access.mockResolvedValue(true);
});

describe("public confirm-payment status", () => {
  it("does not apply a succeeded PaymentIntent from the public confirm route", async () => {
    mocks.engagement.mockResolvedValue({ onboardingFeeStatus: "INVOICED" });
    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, paid: false });
  });

  it("reports paid only from recorded engagement state", async () => {
    mocks.engagement.mockResolvedValue({ onboardingFeeStatus: "PAID" });
    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, paid: true });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ setStatus: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/pipe/offers", async () => {
  class PipeOfferError extends Error {}
  return {
    setPipeOfferStatus: mocks.setStatus,
    PipeOfferError,
  };
});
vi.mock("@/lib/pipe/contacts", () => {
  class PipeBrandError extends Error {}
  return {
    PipeBrandError,
    authenticatePipeRequest: mocks.auth,
  };
});
vi.mock("@/lib/simpleRateLimit", () => ({ checkRateLimit: () => ({ allowed: true, remaining: 1 }) }));

import { POST } from "./route";

const params = Promise.resolve({ id: "o1" });
const post = (body: unknown) =>
  new Request("http://x/api/pipe/offers/o1/status", {
    method: "POST",
    headers: { authorization: "Bearer [REDACTED]" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  mocks.setStatus.mockReset();
  mocks.auth.mockReset().mockReturnValue({ ok: true, actorUserId: "user-1" });
});

describe("/api/pipe/offers/[id]/status", () => {
  it("requires brand and status", async () => {
    expect((await POST(post({}), { params })).status).toBe(400);
    expect((await POST(post({ brand: "b" }), { params })).status).toBe(400);
  });

  it("archives an offer", async () => {
    mocks.setStatus.mockResolvedValue({ id: "o1", status: "archived" });
    const response = await POST(post({ brand: "b", status: "archived" }), { params });
    expect(await response.json()).toEqual({ offer: { id: "o1", status: "archived" } });
    expect(mocks.setStatus).toHaveBeenCalledWith({ actorUserId: "user-1", brand: "b", offerId: "o1", status: "archived" });
  });

  it("rejects an invalid status with 400", async () => {
    mocks.setStatus.mockRejectedValue(new RangeError("Invalid offer status."));
    const response = await POST(post({ brand: "b", status: "nonsense" }), { params });
    expect(response.status).toBe(400);
  });

  it("reports an unknown offer with 404", async () => {
    const { PipeOfferError } = await import("@/lib/pipe/offers");
    mocks.setStatus.mockRejectedValue(new PipeOfferError("Offer not found."));
    const response = await POST(post({ brand: "b", status: "archived" }), { params });
    expect(response.status).toBe(404);
  });
});

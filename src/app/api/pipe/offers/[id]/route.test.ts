import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), del: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/pipe/offers", async () => {
  class PipeOfferError extends Error {}
  return {
    getPipeOffer: mocks.get,
    updatePipeOfferDraft: mocks.update,
    deletePipeOfferDraft: mocks.del,
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

import { DELETE, GET, PATCH } from "./route";

const params = Promise.resolve({ id: "o1" });

const patch = (body: unknown) =>
  new Request("http://x/api/pipe/offers/o1", {
    method: "PATCH",
    headers: { authorization: "Bearer [REDACTED]" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  mocks.get.mockReset();
  mocks.update.mockReset();
  mocks.del.mockReset();
  mocks.auth.mockReset().mockReturnValue({ ok: true, actorUserId: "user-1" });
});

describe("/api/pipe/offers/[id]", () => {
  it("GET requires a brand", async () => {
    const response = await GET(new Request("http://x/api/pipe/offers/o1"), { params });
    expect(response.status).toBe(400);
  });

  it("GET returns the offer", async () => {
    mocks.get.mockResolvedValue({ id: "o1" });
    const response = await GET(new Request("http://x/api/pipe/offers/o1?brand=b"), { params });
    expect(await response.json()).toEqual({ offer: { id: "o1" } });
  });

  it("PATCH saves the draft", async () => {
    mocks.update.mockResolvedValue({ id: "o1", status: "draft" });
    const response = await PATCH(patch({ brand: "b", assessment: { a: 1 } }), { params });
    expect(await response.json()).toEqual({ offer: { id: "o1", status: "draft" } });
    expect(mocks.update).toHaveBeenCalledWith({
      actorUserId: "user-1",
      brand: "b",
      offerId: "o1",
      patch: { assessment: { a: 1 }, pricing: undefined, isTestProposal: undefined },
    });
  });

  it("PATCH on an archived offer is a 409", async () => {
    const { PipeOfferError } = await import("@/lib/pipe/offers");
    mocks.update.mockRejectedValue(new PipeOfferError("This offer is archived."));
    const response = await PATCH(patch({ brand: "b", assessment: {} }), { params });
    expect(response.status).toBe(409);
  });

  it("DELETE removes an untouched draft", async () => {
    mocks.del.mockResolvedValue({ id: "o1", deleted: true });
    const response = await DELETE(new Request("http://x/api/pipe/offers/o1?brand=b", { method: "DELETE" }), {
      params,
    });
    expect(await response.json()).toEqual({ id: "o1", deleted: true });
  });

  it("DELETE on a sent/signed offer is a 409, not a delete", async () => {
    const { PipeOfferError } = await import("@/lib/pipe/offers");
    mocks.del.mockRejectedValue(new PipeOfferError("This offer has been sent, signed, or paid..."));
    const response = await DELETE(new Request("http://x/api/pipe/offers/o1?brand=b", { method: "DELETE" }), {
      params,
    });
    expect(response.status).toBe(409);
  });
});

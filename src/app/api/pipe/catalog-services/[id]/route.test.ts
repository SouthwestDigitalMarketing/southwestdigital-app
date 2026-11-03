import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ update: vi.fn(), archive: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/pipe/catalogServices", async () => {
  class PipeCatalogError extends Error {}
  return {
    updatePipeCatalogService: mocks.update,
    archivePipeCatalogService: mocks.archive,
    PipeCatalogError,
    parsePipeCatalogServiceInput: (body: Record<string, unknown>) => {
      if (!body?.brand) throw new RangeError("brand is required");
      return body;
    },
  };
});
vi.mock("@/lib/pipe/contacts", () => {
  class PipeBrandError extends Error {}
  return { PipeBrandError, authenticatePipeRequest: mocks.auth };
});
vi.mock("@/lib/simpleRateLimit", () => ({ checkRateLimit: () => ({ allowed: true, remaining: 1 }) }));

import { DELETE, PATCH } from "./route";

const params = Promise.resolve({ id: "s1" });
const patch = (body: unknown) =>
  new Request("http://x/api/pipe/catalog-services/s1", {
    method: "PATCH",
    headers: { authorization: "Bearer [REDACTED]" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  mocks.update.mockReset();
  mocks.archive.mockReset();
  mocks.auth.mockReset().mockReturnValue({ ok: true, actorUserId: "user-1" });
});

describe("/api/pipe/catalog-services/[id]", () => {
  it("PATCH requires a brand", async () => {
    expect((await PATCH(patch({ defaultPrice: 190 }), { params })).status).toBe(400);
  });

  it("PATCH sends only the keys the caller supplied", async () => {
    mocks.update.mockResolvedValue({ id: "s1", defaultPrice: 190 });
    const response = await PATCH(patch({ brand: "b", defaultPrice: 190 }), { params });
    expect(await response.json()).toEqual({ service: { id: "s1", defaultPrice: 190 } });
    expect(mocks.update).toHaveBeenCalledWith({
      actorUserId: "user-1",
      brand: "b",
      id: "s1",
      patch: { defaultPrice: 190 },
    });
  });

  it("PATCH reports an unknown service with 404", async () => {
    const { PipeCatalogError } = await import("@/lib/pipe/catalogServices");
    mocks.update.mockRejectedValue(new PipeCatalogError("Service not found."));
    expect((await PATCH(patch({ brand: "b", name: "x" }), { params })).status).toBe(404);
  });

  it("DELETE archives rather than destroying", async () => {
    mocks.archive.mockResolvedValue({ id: "s1", active: false });
    const response = await DELETE(
      new Request("http://x/api/pipe/catalog-services/s1?brand=b", { method: "DELETE" }),
      { params },
    );
    expect(await response.json()).toEqual({ service: { id: "s1", active: false }, archived: true });
    expect(mocks.archive).toHaveBeenCalledWith({ actorUserId: "user-1", brand: "b", id: "s1" });
  });

  it("DELETE requires a brand", async () => {
    const response = await DELETE(
      new Request("http://x/api/pipe/catalog-services/s1", { method: "DELETE" }),
      { params },
    );
    expect(response.status).toBe(400);
  });
});

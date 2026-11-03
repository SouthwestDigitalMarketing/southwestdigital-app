import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/pipe/catalogServices", async () => {
  class PipeCatalogError extends Error {}
  return {
    listPipeCatalogServices: mocks.list,
    createPipeCatalogService: mocks.create,
    PipeCatalogError,
    parsePipeCatalogServiceInput: (body: { brand?: string; name?: string } | null) => {
      if (!body?.brand) throw new RangeError("brand is required");
      if (!body?.name) throw new RangeError("name is required");
      return body;
    },
  };
});
vi.mock("@/lib/pipe/contacts", () => {
  class PipeBrandError extends Error {}
  return { PipeBrandError, authenticatePipeRequest: mocks.auth };
});
vi.mock("@/lib/simpleRateLimit", () => ({ checkRateLimit: () => ({ allowed: true, remaining: 1 }) }));

import { GET, POST } from "./route";

const post = (body: unknown) =>
  new Request("http://x/api/pipe/catalog-services", {
    method: "POST",
    headers: { authorization: "Bearer [REDACTED]" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  mocks.list.mockReset();
  mocks.create.mockReset();
  mocks.auth.mockReset().mockReturnValue({ ok: true, actorUserId: "user-1" });
});

describe("/api/pipe/catalog-services", () => {
  it("rejects an unauthenticated request", async () => {
    mocks.auth.mockReturnValue({ ok: false, status: 401 });
    expect((await GET(new Request("http://x/api/pipe/catalog-services?brand=b"))).status).toBe(401);
  });

  it("GET requires a brand", async () => {
    expect((await GET(new Request("http://x/api/pipe/catalog-services"))).status).toBe(400);
  });

  it("GET lists active services by default and passes includeInactive through", async () => {
    mocks.list.mockResolvedValue([{ id: "s1" }]);
    const response = await GET(new Request("http://x/api/pipe/catalog-services?brand=b&includeInactive=1&q=bill"));
    expect(await response.json()).toEqual({ services: [{ id: "s1" }] });
    expect(mocks.list).toHaveBeenCalledWith({
      actorUserId: "user-1",
      brand: "b",
      includeInactive: true,
      query: "bill",
    });
  });

  it("POST creates a service and returns 201", async () => {
    mocks.create.mockResolvedValue({ id: "s1", name: "AP / Bill Entry" });
    const response = await POST(post({ brand: "b", name: "AP / Bill Entry", defaultPrice: 190 }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ service: { id: "s1", name: "AP / Bill Entry" } });
  });

  it("POST rejects missing fields with 400", async () => {
    expect((await POST(post({ brand: "b" }))).status).toBe(400);
    expect((await POST(post({ name: "x" }))).status).toBe(400);
  });

  it("POST reports a duplicate offerKey with 409", async () => {
    const { PipeCatalogError } = await import("@/lib/pipe/catalogServices");
    mocks.create.mockRejectedValue(new PipeCatalogError("A service with that offerKey already exists."));
    expect((await POST(post({ brand: "b", name: "dupe" }))).status).toBe(409);
  });

  it("POST reports an unknown brand with 404", async () => {
    const { PipeBrandError } = await import("@/lib/pipe/contacts");
    mocks.create.mockRejectedValue(new PipeBrandError("unknown brand b"));
    expect((await POST(post({ brand: "b", name: "x" }))).status).toBe(404);
  });
});

import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  brand: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { brand: { findUnique: mocks.brand } } }));
vi.mock("@/lib/scanner/post", () => ({
  findScannerBrand: mocks.brand,
  postScanFinding: mocks.post,
  isScanStorageMissing: () => false,
}));

import { POST } from "./route";

const token = "scanner-secret";
const body = {
  brand: "bookkeeping-conroe",
  room: "payments",
  key: "stripe:py_123",
  what: "A card payment came in",
  severity: "normal",
  evidence: "Stripe py_123",
  fixLevel: 1,
  role: "sales-pipeline",
  presence: "open",
};

function call(payload: unknown, authorization = `Bearer ${token}`) {
  return POST(new Request("http://x/api/scanner/findings", {
    method: "POST",
    headers: { authorization },
    body: JSON.stringify(payload),
  }));
}

beforeEach(() => {
  process.env.SCANNER_API_TOKEN_SHA256 = createHash("sha256").update(token).digest("hex");
  process.env.SCANNER_API_ACTOR_USER_ID = "user-1";
  mocks.brand.mockReset();
  mocks.post.mockReset();
  mocks.brand.mockResolvedValue({ id: "brand-1", slug: "bookkeeping-conroe", status: "ACTIVE", deletedAt: null });
  mocks.post.mockResolvedValue({ mode: "log-only", id: "f1", state: "open", created: true, reopened: false, changed: true });
});

describe("POST /api/scanner/findings", () => {
  it("records a finding and returns the log-only result", async () => {
    const response = await call(body);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ mode: "log-only", id: "f1", created: true });
    expect(mocks.post).toHaveBeenCalledWith(expect.objectContaining({ brandId: "brand-1", actorUserId: "user-1" }));
  });

  it("does not record a forbidden brand or a missing token", async () => {
    const other = await call({ ...body, brand: "melbourne-cfo" });
    expect(other.status).toBe(403);
    const denied = await call(body, "Bearer nope");
    expect(denied.status).toBe(401);
    expect(mocks.post).not.toHaveBeenCalled();
  });
});

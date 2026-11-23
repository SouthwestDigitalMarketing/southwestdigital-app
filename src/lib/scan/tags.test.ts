import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ tag: vi.fn(), finding: vi.fn() }));
vi.mock("@/lib/pipe/tags", () => ({ applyPipeTag: mocks.tag }));
vi.mock("@/lib/scanner/post", () => ({ postScanFinding: mocks.finding }));

import type { PrismaClient } from "@prisma/client";
const { applyTagEvidence } = await import("./tags");
const asDb = (fake: unknown) => fake as unknown as PrismaClient;

const db = (overrides: Record<string, unknown> = {}) => ({
  engagement: { findMany: vi.fn(async () => []) },
  contact: { findMany: vi.fn(async () => []), findUnique: vi.fn(async () => null) },
  contactTagLink: { findMany: vi.fn(async () => []) },
  leadContact: { findMany: vi.fn(async () => []) },
  pipeline: { findFirst: vi.fn(async () => null) },
  pipelineStage: { findMany: vi.fn(async () => []) },
  pipelineItem: { findMany: vi.fn(async () => []), update: vi.fn(async () => ({})) },
  lead: { findMany: vi.fn(async () => []) },
  ...overrides,
});
const brand = { id: "b1", slug: "bookkeeping-conroe" };

beforeEach(() => {
  mocks.tag.mockReset().mockResolvedValue({ changed: true });
  mocks.finding.mockReset().mockResolvedValue({ created: true });
});

describe("applyTagEvidence", () => {
  it("tags a signed engagement's contact and lists it", async () => {
    const fake = db({
      engagement: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            { id: "e1", clientName: "Acme", primaryContactEmail: "a@x.com", billingContactEmail: null, updatedAt: new Date() },
          ])
          .mockResolvedValue([]),
      },
      contact: {
        findMany: vi.fn(async () => [{ id: "c1", name: "Acme", email: "a@x.com" }]),
        findUnique: vi.fn(async () => null),
      },
    });
    const result = await applyTagEvidence({ db: asDb(fake), actorUserId: "scan", brands: [brand], since: new Date() });
    expect(mocks.tag).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({ contactId: "c1", tag: "contract-signed", action: "add" }),
    }));
    expect(result.changes).toEqual([{ kind: "swapp", text: "Acme: contract signed" }]);
    expect(result.fixed).toBe(1);
  });

  it("moves to won when a deposit lands on a signed contact", async () => {
    const fake = db({
      engagement: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValue([
            { id: "e2", clientName: "Rodan", primaryContactEmail: "r@x.com", billingContactEmail: null, updatedAt: new Date(), status: "DEPOSIT_PAID" },
          ]),
      },
      contact: {
        findMany: vi.fn(async () => [{ id: "c2", name: "Rodan", email: "r@x.com" }]),
        findUnique: vi.fn(async () => null),
      },
      contactTagLink: {
        findMany: vi.fn(async (args: unknown) => {
          const where = (args as { where?: { contactId?: string; tag?: unknown } }).where ?? {};
          if (where.contactId) return [{ tag: { key: "contract-signed" } }];
          return [];
        }),
      },
      pipeline: { findFirst: vi.fn(async () => ({ id: "p1" })) },
      pipelineStage: { findMany: vi.fn(async () => [{ id: "s-won", key: "won" }, { id: "s-p", key: "proposed" }]) },
      leadContact: { findMany: vi.fn(async () => [{ leadId: "l1" }]) },
      pipelineItem: {
        findMany: vi.fn(async (args: unknown) => {
          const where = (args as { where?: { stage?: { key?: string } } }).where;
          if (where?.stage?.key === "won") return [];
          return [{ id: "i1", stage: { key: "proposed" } }];
        }),
        update: vi.fn(async () => ({})),
      },
    });
    const result = await applyTagEvidence({ db: asDb(fake), actorUserId: "scan", brands: [brand], since: new Date() });
    expect(result.changes.map((change) => change.text)).toContain("Rodan: proposed → won");
  });

  it("files a judgment when money proof is missing, never tagging", async () => {
    const byTag = async (args: unknown) => {
      const key = (args as { where?: { tag?: { key?: string } } }).where?.tag?.key;
      return key === "paid" ? [{ contact: { id: "c9", name: "Ghost", email: "g@x.com" } }] : [];
    };
    const fake = db({ contactTagLink: { findMany: vi.fn(byTag) } });
    const result = await applyTagEvidence({ db: asDb(fake), actorUserId: "scan", brands: [brand], since: new Date() });
    expect(mocks.tag).not.toHaveBeenCalled();
    expect(mocks.finding).toHaveBeenCalledWith(expect.objectContaining({
      brandId: "b1",
      input: expect.objectContaining({ room: "payments", fixLevel: 2 }),
    }));
    expect(result.judgments).toBeGreaterThan(0);
  });

  it("removes the lead tag when nothing is open", async () => {
    const byTag = async (args: unknown) => {
      const key = (args as { where?: { tag?: { key?: string } } }).where?.tag?.key;
      return key === "lead" ? [{ contact: { id: "c3", name: "Cold", email: "cold@x.com" } }] : [];
    };
    const fake = db({ contactTagLink: { findMany: vi.fn(byTag) } });
    const result = await applyTagEvidence({ db: asDb(fake), actorUserId: "scan", brands: [brand], since: new Date() });
    expect(mocks.tag).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({ contactId: "c3", tag: "lead", action: "remove" }),
    }));
    expect(result.changes.map((change) => change.text)).toContain("Cold: lead tag removed (nothing open)");
  });
});
